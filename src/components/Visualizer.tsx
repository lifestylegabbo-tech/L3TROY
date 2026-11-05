'use client';

import { useEffect, useRef } from 'react';

type Props = {
  analyser?: AnalyserNode | null;
  active?: boolean;
  className?: string;
  bars?: number;
  mirror?: boolean;
};

/** Visualizador de barras. Con un AnalyserNode usa el audio real; sin él, anima una onda sintética. */
export default function Visualizer({ analyser, active = true, className, bars = 64, mirror = false }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ analyser, active });
  live.current = { analyser, active };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    const heights = new Float32Array(bars);
    const data = new Uint8Array(128);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const { analyser: an, active: on } = live.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (an && on) an.getByteFrequencyData(data);
      const gap = Math.max(2, W / bars / 4);
      const bw = W / bars - gap;
      const grad = ctx.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, '#ffb21a');
      grad.addColorStop(0.55, '#ee0e26');
      grad.addColorStop(1, '#ff5c28');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#ee0e26';
      ctx.shadowBlur = 14;
      for (let i = 0; i < bars; i++) {
        let target: number;
        if (an && on) {
          const idx = Math.min(data.length - 1, Math.floor((i / bars) * data.length * 0.75));
          target = data[idx] / 255;
        } else if (reduce) {
          target = 0.18 + 0.1 * Math.sin(i * 0.5);
        } else {
          const s = t / 1000;
          target =
            0.2 +
            0.28 * Math.abs(Math.sin(s * 1.6 + i * 0.35)) * (0.6 + 0.4 * Math.sin(s * 0.7 + i * 0.12)) +
            0.12 * Math.abs(Math.sin(s * 3.1 + i * 0.9));
          if (!on) target *= 0.55;
        }
        heights[i] += (target - heights[i]) * 0.22;
        const h = Math.max(3, heights[i] * H * 0.95);
        const x = i * (bw + gap) + gap / 2;
        if (mirror) {
          ctx.fillRect(x, H / 2 - h / 2, bw, h);
        } else {
          ctx.fillRect(x, H - h, bw, h);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [bars, mirror]);

  return <canvas ref={ref} className={className} aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />;
}
