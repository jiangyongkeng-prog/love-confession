/* ============================================================
 * Fireworks - Heart-shaped firework explosion effect
 * Style: Deep Space Romance - Rose pink & gold particles
 * ============================================================ */

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  isHeart: boolean;
}

interface FireworksProps {
  trigger: boolean;
  onComplete?: () => void;
}

export default function Fireworks({ trigger, onComplete }: FireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const isRunningRef = useRef(false);

  const createHeartFirework = useCallback((cx: number, cy: number) => {
    const colors = [
      "oklch(0.72 0.18 350)",
      "oklch(0.85 0.12 85)",
      "oklch(0.80 0.15 30)",
      "oklch(0.90 0.08 85)",
      "oklch(0.75 0.20 340)",
    ];

    // Heart shape points
    const heartPoints: [number, number][] = [];
    for (let t = 0; t < Math.PI * 2; t += 0.2) {
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      heartPoints.push([hx, hy]);
    }

    // Heart particles
    heartPoints.forEach(([hx, hy]) => {
      const speed = Math.random() * 3 + 2;
      const angle = Math.atan2(hy, hx);
      const dist = Math.sqrt(hx * hx + hy * hy);
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: (hx / dist) * speed * (dist / 20),
        vy: (hy / dist) * speed * (dist / 20),
        life: 1,
        maxLife: Math.random() * 60 + 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 3 + 2,
        isHeart: true,
      });
    });

    // Burst particles
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const speed = Math.random() * 6 + 2;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: Math.random() * 40 + 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 2 + 1,
        isHeart: false,
      });
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 1 / p.maxLife;

      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.isHeart) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;

    if (particlesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      isRunningRef.current = false;
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Launch multiple fireworks
    const positions = [
      [canvas.width * 0.3, canvas.height * 0.35],
      [canvas.width * 0.5, canvas.height * 0.25],
      [canvas.width * 0.7, canvas.height * 0.35],
      [canvas.width * 0.2, canvas.height * 0.5],
      [canvas.width * 0.8, canvas.height * 0.5],
    ];

    positions.forEach(([x, y], i) => {
      setTimeout(() => {
        createHeartFirework(x, y);
      }, i * 200);
    });

    if (!isRunningRef.current) {
      isRunningRef.current = true;
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [trigger, createHeartFirework, animate]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    />
  );
}
