"use client";

import { useEffect, useRef } from "react";

/**
 * Live microphone level meter (Web Audio AnalyserNode).
 *
 * Mount it only while the mic is active. It renders 7 bars driven by the real
 * input amplitude AND mirrors the normalized level (0–1) into the CSS custom
 * property `--mic-level` on its wrapper — so the mic button (class `mic-live`
 * in globals.css) can glow and pulse with your actual voice.
 *
 * Note: runs getUserMedia alongside SpeechRecognition — Chrome/Edge allow
 * both simultaneously. If permission is denied the meter stays flat while
 * SpeechRecognition's own error path reports the problem.
 */
export default function MicLevel({ active }: { active: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const x = (data[i] - 128) / 128;
            sum += x * x;
          }
          const rms = Math.sqrt(sum / data.length); // 0..~1
          const level = Math.min(1, rms * 3.2); // perceptual boost
          const wrap = wrapRef.current;
          if (wrap) {
            wrap.style.setProperty("--mic-level", level.toFixed(3));
            // Mirror to the mic button (closest input bar) so it glows too.
            document.documentElement.style.setProperty("--mic-level", level.toFixed(3));
            const bars = wrap.children;
            const n = bars.length;
            for (let i = 0; i < n; i++) {
              // Bars near the center react more — pseudo-spectrum shape.
              const center = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1);
              const jitter = 0.75 + 0.25 * Math.sin(Date.now() / 90 + i * 1.7);
              const h = 4 + Math.min(20, level * 26 * (0.35 + 0.65 * center) * jitter);
              (bars[i] as HTMLElement).style.height = `${h}px`;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* mic unavailable — meter stays flat; recognition reports its own error */
      }
    };
    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
      document.documentElement.style.setProperty("--mic-level", "0");
    };
  }, [active]);

  return (
    <div ref={wrapRef} aria-hidden className="flex items-center gap-[3px] px-1" style={{ "--mic-level": 0 } as React.CSSProperties}>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{ height: 4, background: "var(--accent)", opacity: 0.85, transition: "height 60ms linear" }}
        />
      ))}
    </div>
  );
}
