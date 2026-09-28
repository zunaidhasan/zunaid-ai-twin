"use client";

import { useEffect, useRef } from "react";
import { twinLevel } from "@/lib/voice";

/**
 * Ambient starfield that gently reacts to conversation topics.
 *
 * Every reply emits a topic "mood" (hue + burst). Stars drift toward the hue,
 * and a burst briefly accelerates them — like the sky noticing the chat.
 * Pure canvas, ~140 stars, respects prefers-reduced-motion.
 *
 * ⚙️ PLUG-IN POINT (analytics): mood changes are a nice proxy for engagement —
 * call recordEvent from setMood() callers if you want topic tracking.
 */

export type Mood = { hue: number; burst?: boolean };

const MOOD_HUES: Record<string, number> = {
  neutral: 200, // cool blue
  voice: 285, // purple — DeshVox / voice
  bangla: 145, // Bangladesh green
  projects: 165, // teal
  ai: 265, // violet
  warm: 35, // amber — greetings/fun
  alert: 0, // roast 🔥
};

export function moodForTopic(text: string): Mood {
  const t = text.toLowerCase();
  let hue = MOOD_HUES.neutral;
  if (/voice|deshvox|ivr|tts|retell|elevenlabs/.test(t)) hue = MOOD_HUES.voice;
  else if (/bangla|বাংলা|bengali|desh|maatigyan/.test(t)) hue = MOOD_HUES.bangla;
  else if (/project|stack|build|ship/.test(t)) hue = MOOD_HUES.projects;
  else if (/ai|model|rag|llm|neural/.test(t)) hue = MOOD_HUES.ai;
  else if (/roast|matrix|stats/.test(t)) hue = MOOD_HUES.alert;
  else if (/hi|hello|thanks|welcome/.test(t)) hue = MOOD_HUES.warm;
  return { hue, burst: true };
}

type Star = {
  x: number;
  y: number;
  z: number; // depth 0..1
  r: number;
  tw: number; // twinkle phase
};

export default function Starfield({ mood }: { mood: Mood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const hueRef = useRef(mood.hue);
  const targetHueRef = useRef(mood.hue);
  const burstRef = useRef(0);
  const mouseRef = useRef({ x: -1, y: -1 });

  useEffect(() => {
    targetHueRef.current = mood.hue;
    if (mood.burst) burstRef.current = 1;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const count = Math.min(150, Math.floor((w * h) / 9000));
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    seed();

    const onResize = () => {
      resize();
      seed();
    };
    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouse, { passive: true });

    let t = 0;
    let level = 0; // smoothed twin voice amplitude (eases toward twinLevel.current)
    const draw = () => {
      t += 0.016;
      // Ease hue toward the topic mood; decay the burst.
      hueRef.current += (targetHueRef.current - hueRef.current) * 0.03;
      burstRef.current *= 0.96;
      // Smooth the twin's voice amplitude so the sky breathes, not flickers.
      level += (twinLevel.current - level) * 0.08;

      ctx.clearRect(0, 0, w, h);

      // Subtle nebula glow following the mood hue — brightens with the voice.
      const glowBoost = level * 0.05;
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, Math.max(w, h) * 0.75);
      grad.addColorStop(0, `hsla(${hueRef.current}, 70%, 55%, ${0.10 + glowBoost})`);
      grad.addColorStop(0.5, `hsla(${hueRef.current}, 70%, 45%, ${0.045 + glowBoost * 0.45})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const burst = burstRef.current;
      for (const s of starsRef.current) {
        // Drift: slow rise; faster during topic bursts and while the twin speaks.
        const speed = (0.06 + s.z * 0.22) * (1 + burst * 5 + level * 1.8);
        s.y -= speed;
        s.x += Math.sin(t * 0.3 + s.tw) * (0.06 + level * 0.3);
        if (s.y < -4) {
          s.y = h + 4;
          s.x = Math.random() * w;
        }

        // Twinkle — amplitude adds brightness and a subtle size swell.
        const tw = 0.55 + Math.sin(t * (1 + s.z) + s.tw) * 0.35;
        const depth = 0.35 + s.z * 0.65;
        const bright = tw * depth + level * 0.35 * depth;
        const radius = s.r * depth * (1 + level * 0.5);

        // Mouse parallax — the sky leans toward you.
        const dx = mouseRef.current.x - s.x;
        const dy = mouseRef.current.y - s.y;
        const dist = Math.hypot(dx, dy);
        const pull = dist < 140 ? (1 - dist / 140) * 6 * s.z : 0;

        ctx.beginPath();
        ctx.arc(s.x + (dx / (dist || 1)) * pull, s.y + (dy / (dist || 1)) * pull, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hueRef.current + s.z * 40 - 20}, 80%, ${70 + s.z * 15}%, ${Math.min(1, bright)})`;
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw(); // if reduced motion: draws a single static frame

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 h-full w-full"
    />
  );
}
