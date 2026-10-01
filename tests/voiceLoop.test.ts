import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createVoiceLoop, type VoiceLoopTimers } from "../lib/voiceLoop.ts";

/**
 * Targeted tests for the hands-free voice loop:
 *   speak → the twin replies out loud → mic reopens
 *
 * The loop was extracted from page.tsx into lib/voiceLoop.ts so these races
 * are testable without a browser: stale TTS endings reopening the mic after a
 * new turn started, reopening into a busy twin, double reopen schedules, and
 * stranded transcripts on no-speech.
 */

type Scheduled = { fn: () => void; ms: number; id: number };

class FakeTimers implements VoiceLoopTimers {
  queue: Scheduled[] = [];
  private nextId = 1;

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.queue.push({ fn, ms, id });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.queue = this.queue.filter((t) => t.id !== handle);
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  /** Runs every due timer; returns simulated ms elapsed. */
  runAll(): number {
    let elapsed = 0;
    while (this.queue.length) {
      const due = this.queue.filter((t) => t.ms <= 10000); // no runaway loops
      if (!due.length) break;
      const fastest = Math.min(...due.map((t) => t.ms));
      elapsed += fastest;
      for (const t of this.queue.filter((x) => x.ms === fastest)) {
        this.clearTimeout(t.id);
        t.fn();
      }
    }
    return elapsed;
  }

  /** Runs a single timer advance of exactly `ms` (if one is due). */
  advance(ms: number): boolean {
    const idx = this.queue.findIndex((t) => t.ms === ms);
    if (idx === -1) return false;
    const [t] = this.queue.splice(idx, 1);
    t.fn();
    return true;
  }
}

function makeLoop(opts?: { reopenDelayMs?: number; recheckDelayMs?: number; reopenPostponeLimitMs?: number }) {
  const timers = new FakeTimers();
  let micOpens = 0;
  let speakCalls = 0;
  let speakDone: (() => void) | null = null;
  let twinBusy = false;

  const loop = createVoiceLoop({
    reopenDelayMs: opts?.reopenDelayMs ?? 600,
    recheckDelayMs: opts?.recheckDelayMs ?? 300,
    reopenPostponeLimitMs: opts?.reopenPostponeLimitMs ?? 8000,
    timers,
  });
  loop.setCallbacks({
    startMic: () => {
      micOpens += 1;
    },
    speakReply: (done) => {
      speakCalls += 1;
      speakDone = done;
    },
    isTwinBusy: () => twinBusy,
  });

  return {
    loop,
    timers,
    get micOpens() {
      return micOpens;
    },
    get speakCalls() {
      return speakCalls;
    },
    set twinBusy(v: boolean) {
      twinBusy = harnessTwinBusy(v);
    },
    finishSpeaking() {
      speakDone?.();
      speakDone = null;
    },
  };

  function harnessTwinBusy(v: boolean) {
    return v;
  }
}

/* ----------------------------- happy path ----------------------------- */

test("happy path: speak → reply out loud → mic reopens after TTS ends + settle delay", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: true, handsFree: true });

  assert.equal(h.speakCalls, 1, "reply is spoken");
  h.finishSpeaking(); // TTS ends
  assert.equal(h.timers.pendingCount, 1, "reopen scheduled once TTS ends");
  assert.ok(h.timers.advance(600), "reopen fires after settle delay");
  assert.equal(h.micOpens, 1, "mic reopens exactly once");
  assert.equal(h.loop.debugState().phase, "mic");
});

test("hands-free without voice replies reopens after streaming ends", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });

  assert.equal(h.speakCalls, 0, "no TTS when voice replies are off");
  assert.ok(h.timers.advance(600));
  assert.equal(h.micOpens, 1);
});

test("voice replies speak even when hands-free is off — no reopen scheduled", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: true, handsFree: false });

  assert.equal(h.speakCalls, 1, "voice replies speak regardless of hands-free");
  h.finishSpeaking();
  assert.equal(h.timers.pendingCount, 0, "no reopen without hands-free");
  assert.equal(h.micOpens, 0);
  assert.equal(h.loop.debugState().phase, "idle");
});

/* -------------------------- race protection --------------------------- */

test("stale TTS ending after a new turn started does not reopen the mic", () => {
  const h = makeLoop();
  h.loop.onTwinStart(); // epoch 1
  h.loop.onReplyComplete({ voiceOn: true, handsFree: true });
  assert.equal(h.speakCalls, 1);

  h.loop.onTwinStart(); // epoch 2 — user sent again / new reply began
  h.finishSpeaking(); // stale TTS ending from epoch 1

  assert.equal(h.timers.pendingCount, 0, "no reopen from the stale ending");
  h.timers.runAll();
  assert.equal(h.micOpens, 0, "mic never opens from a stale ending");
});

test("two competing reopen schedules open the mic exactly once", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  // Two onReplyComplete calls race (e.g. streamer done + TTS end path).
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });

  h.timers.runAll();
  assert.equal(h.micOpens, 1, "deduplicated by the reopenArmed guard");
});

test("new turn cancels a pending reopen (no mid-reply mic open)", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });
  // Reopen pending but not yet fired — user sends the next message.
  h.loop.onTwinStart();
  h.timers.runAll();
  assert.equal(h.micOpens, 0);
});

/* ------------------------ busy-twin postponement ----------------------- */

test("reopen postpones while the twin is busy, then fires once idle", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });

  h.twinBusy = true;
  h.timers.advance(600); // reopen delay fires → busy → recheck scheduled
  assert.equal(h.micOpens, 0, "no mic open while busy");
  assert.equal(h.loop.debugState().phase, "waiting-for-twin");

  h.timers.advance(300); // recheck 1 (still busy)
  h.timers.advance(300); // recheck 2 (still busy)
  assert.equal(h.micOpens, 0);

  h.twinBusy = false;
  h.timers.advance(300); // recheck 3 → idle → open
  assert.equal(h.micOpens, 1, "opens as soon as the twin is idle");
});

test("reopen gives up after the postpone limit instead of firing into a busy twin", () => {
  const h = makeLoop({ reopenPostponeLimitMs: 900, recheckDelayMs: 300 });
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });

  h.twinBusy = true;
  h.timers.runAll(); // 600 reopen + up to 3 rechecks (900ms limit)
  assert.equal(h.micOpens, 0, "never opens into a busy twin");
  assert.equal(h.loop.debugState().phase, "idle", "gave up cleanly");
});

/* ------------------------------ lifecycle ----------------------------- */

test("dispose cancels pending timers and disables the controller", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });
  h.loop.dispose();

  h.timers.runAll();
  assert.equal(h.micOpens, 0);
  assert.equal(h.loop.debugState().liveTimers, 0);
});

test("onMicClosed returns the loop to idle", () => {
  const h = makeLoop();
  h.loop.onTwinStart();
  h.loop.onReplyComplete({ voiceOn: false, handsFree: true });
  h.timers.advance(600);
  assert.equal(h.loop.debugState().phase, "mic");
  h.loop.onMicClosed();
  assert.equal(h.loop.debugState().phase, "idle");
});
