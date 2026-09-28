"use client";

import { useEffect, useRef } from "react";
import { matrixLines } from "@/lib/knowledge";

/** Mini matrix rain — the "matrix" command easter egg. */
export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cols: number[] = [];
    const glyphs = "アカサタナハマヤラワエキシチニヒミリヌフムユル0123456789ZUNAID<>/*-+";

    const resize = () => {
      canvas.width = canvas.clientWidth * 2;
      canvas.height = canvas.clientHeight * 2;
      ctx.scale(2, 2);
      cols = Array.from({ length: Math.floor(canvas.clientWidth / 12) }, () => Math.random() * canvas.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const draw = () => {
      t += 0.05;
      ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.font = "11px monospace";
      cols.forEach((y, i) => {
        const g = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * 12 + 4;
        ctx.fillStyle = Math.random() > 0.975 ? "#d1fae5" : "#22c55e";
        ctx.fillText(g, x, y);
        cols[i] = y > canvas.clientHeight + Math.random() * 400 ? 0 : y + 11;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="mt-2 w-full overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
      <canvas ref={ref} className="h-36 w-full" aria-label="Matrix rain animation" role="img" />
      <div className="px-3 py-2 text-center font-mono text-[11px]" style={{ background: "var(--surface)", color: "#22c55e" }}>
        {matrixLines[Math.floor(Math.random() * matrixLines.length)]}
      </div>
    </div>
  );
}
