/**
 * Hands-free voice loop orchestration.
 *
 * The advertised loop: speak → the twin replies out loud → mic reopens.
 * Extracted from page.tsx so the reopen timing is unit-testable — the naive
 * `setTimeout(() => startMic(), 600)` version had real races:
 *
 *   1. User sends a new message while a reopen is pending → stale timer opens
 *      the mic mid-reply and a second TTS pass can fire (double-speak).
 *   2. The twin is busy (streaming/LLM) when the reopen fires → SpeechRecognition
 *      starts, hears half a reply, and its transcript is dropped.
 *   3. Two schedules racing (TTS end + streaming end) → double mic open.
 *
 * Model: an epoch invalidates all in-flight timers and stale TTS endings the
 * moment a new turn starts; busy re-polling postpones the reopen (bounded by
 * `reopenPostponeLimitMs`) instead of blindly firing into a busy twin.
 *
 * Timers are injected so tests drive the clock deterministically.
 */

export type VoiceLoopCallbacks = {
  /** Opens the mic (MessageInput registers the real starter via micHandleRef). */
  startMic: () => void;
  /** Speaks the last reply aloud; MUST call onSpoken exactly once when done. */
  speakReply: (onSpoken: () => void) => void;
  /** True while the twin is generating/streaming a reply. */
  isTwinBusy: () => boolean;
};

export type VoiceLoopTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type VoiceLoopOptions = {
  /** Settle gap between "reply/TTS finished" and reopening the mic (ms). */
  reopenDelayMs?: number;
  /** Interval between busy re-poll attempts (ms). */
  recheckDelayMs?: number;
  /** Max total time a reopen may be postponed while the twin is busy (ms). */
  reopenPostponeLimitMs?: number;
  /** Inject for tests; defaults to the global timers. */
  timers?: VoiceLoopTimers;
};

export type VoiceLoopDebug = {
  phase: "idle" | "reply" | "reopen-pending" | "waiting-for-twin" | "mic";
  liveTimers: number;
  busyRechecks: number;
};

export type VoiceLoop = {
  /** Refresh callbacks each render — keeps closures current without re-binding. */
  setCallbacks: (cb: VoiceLoopCallbacks) => void;
  /** A new turn started (user sent or twin reply began): invalidates pending reopens. */
  onTwinStart: () => void;
  /** The reply finished streaming; speaks it if voice replies are on, then reopens. */
  onReplyComplete: (config: { voiceOn: boolean; handsFree: boolean }) => void;
  /** The mic session closed (bookkeeping — loop re-arms on the next reply). */
  onMicClosed: () => void;
  /** Clear all pending timers; controller is inert afterwards. */
  dispose: () => void;
  /** Diagnostic snapshot for tests. */
  debugState: () => VoiceLoopDebug;
};

export function createVoiceLoop(options: VoiceLoopOptions = {}): VoiceLoop {
  const reopenDelayMs = options.reopenDelayMs ?? 600;
  const recheckDelayMs = options.recheckDelayMs ?? 300;
  const reopenPostponeLimitMs = options.reopenPostponeLimitMs ?? 8000;
  const maxRechecks = Math.max(1, Math.ceil(reopenPostponeLimitMs / recheckDelayMs));
  const timers: VoiceLoopTimers =
    options.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
    };

  let cb: VoiceLoopCallbacks = { startMic: () => {}, speakReply: () => {}, isTwinBusy: () => false };
  let disposed = false;
  // Bumping the epoch cancels every in-flight schedule and stale TTS ending.
  let epoch = 0;
  let phase: VoiceLoopDebug["phase"] = "idle";
  let liveTimers = 0;
  let busyRechecks = 0;
  let reopenArmed = false; // exactly one live reopen path at a time
  const handles = new Set<unknown>();

  const createTimer = (fn: () => void, ms: number): unknown => {
    const handle = timers.setTimeout(() => {
      handles.delete(handle);
      liveTimers = Math.max(0, liveTimers - 1);
      fn();
    }, ms);
    handles.add(handle);
    liveTimers += 1;
    return handle;
  };

  const clearAllTimers = () => {
    for (const h of handles) timers.clearTimeout(h);
    handles.clear();
    liveTimers = 0;
  };

  const tryReopen = (fromEpoch: number) => {
    if (disposed || fromEpoch !== epoch) return;
    if (cb.isTwinBusy()) {
      // Reply still in flight — postpone instead of opening the mic into it.
      if (busyRechecks >= maxRechecks) {
        // Waited past the limit: give up quietly; the next reply re-arms the loop.
        phase = "idle";
        busyRechecks = 0;
        return;
      }
      busyRechecks += 1;
      phase = "waiting-for-twin";
      reopenArmed = true;
      createTimer(() => {
        reopenArmed = false;
        tryReopen(fromEpoch);
      }, recheckDelayMs);
      return;
    }
    // Twin idle → open the mic once. If it fails to actually open
    // (permissions, unsupported browser) the next reply re-arms the loop.
    phase = "mic";
    cb.startMic();
  };

  const scheduleReopen = (fromEpoch: number) => {
    if (disposed || fromEpoch !== epoch || reopenArmed) return;
    reopenArmed = true;
    phase = "reopen-pending";
    createTimer(() => {
      reopenArmed = false;
      tryReopen(fromEpoch);
    }, reopenDelayMs);
  };

  return {
    setCallbacks(next) {
      cb = next;
    },

    onTwinStart() {
      if (disposed) return;
      epoch += 1;
      reopenArmed = false;
      busyRechecks = 0;
      clearAllTimers();
      phase = "reply";
    },

    onReplyComplete(config) {
      if (disposed) return;
      const at = epoch;
      // Voice replies speak whenever voiceOn is on — independent of hands-free.
      if (config.voiceOn) {
        phase = "reply";
        cb.speakReply(() => {
          if (at !== epoch) return; // stale TTS ending — a new turn started
          if (config.handsFree) scheduleReopen(at);
          else phase = "idle";
        });
        return;
      }
      if (config.handsFree) {
        scheduleReopen(at);
        return;
      }
      phase = "idle";
    },

    onMicClosed() {
      if (disposed) return;
      if (phase === "mic") phase = "idle";
    },

    dispose() {
      disposed = true;
      epoch += 1;
      reopenArmed = false;
      clearAllTimers();
      phase = "idle";
    },

    debugState: () => ({ phase, liveTimers, busyRechecks }),
  };
}
