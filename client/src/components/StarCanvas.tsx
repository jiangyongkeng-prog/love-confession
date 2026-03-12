/* ============================================================
 * StarCanvas - Dynamic star field background
 * Style: Deep Space Romance - Midnight Navy with twinkling stars
 * ============================================================ */

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  speed: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export default function StarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: Star[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 3000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));
    };

    let time = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.016;

      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.twinkleOffset);
        const currentOpacity = star.opacity * (0.6 + 0.4 * twinkle);
        const currentRadius = star.radius * (0.85 + 0.15 * twinkle);

        // Warm gold stars
        const isGold = star.radius > 1.2;
        const color = isGold
          ? `oklch(0.85 0.12 85 / ${currentOpacity})`
          : `oklch(0.95 0.02 260 / ${currentOpacity})`;

        ctx.beginPath();
        ctx.arc(star.x, star.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow for larger stars
        if (star.radius > 1.0) {
          const gradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, currentRadius * 4
          );
          gradient.addColorStop(0, isGold
            ? `oklch(0.85 0.12 85 / ${currentOpacity * 0.4})`
            : `oklch(0.95 0.02 260 / ${currentOpacity * 0.3})`
          );
          gradient.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(star.x, star.y, currentRadius * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
