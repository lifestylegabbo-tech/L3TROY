'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Iluminación reactiva al puntero + crossfader de progreso. Respeta prefers-reduced-motion. */
export function Ambient() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.3;
    let cx = tx;
    let cy = ty;
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      root.style.setProperty('--mx', `${cx}px`);
      root.style.setProperty('--my', `${cy}px`);
      raf = requestAnimationFrame(tick);
    };
    const scroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0));
    };
    if (!reduce) {
      window.addEventListener('pointermove', move, { passive: true });
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
    };
  }, []);
  return (
    <>
      <div className="crossfader" aria-hidden>
        <i />
      </div>
      <div className="ambient" aria-hidden />
      <div className="grain" aria-hidden />
    </>
  );
}

export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' | 'article' }) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const style = { '--d': `${delay}s` } as CSSProperties;
  const Comp = Tag as 'div';
  return (
    <Comp ref={ref as React.RefObject<HTMLDivElement>} className={`reveal ${on ? 'in' : ''} ${className}`} style={style}>
      {children}
    </Comp>
  );
}

export function WaveDivider({ color = 'var(--purple)' }: { color?: string }) {
  const pts = Array.from({ length: 80 }, (_, i) => {
    const x = (i / 79) * 1200;
    const amp = 6 + 20 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11));
    return `M${x.toFixed(1)} ${(28 - amp).toFixed(1)}V${(28 + amp).toFixed(1)}`;
  }).join('');
  return (
    <svg className="wave-divider" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden>
      <path d={pts} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}

const LINKS = [
  ['historia', 'Historia'],
  ['estudio', 'Estudio'],
  ['sets', 'Sets'],
  ['eventos', 'En cabina'],
  ['galeria', 'Galería'],
  ['cotiza', 'Cotiza'],
  ['contacto', 'Booking'],
] as const;

export function Nav({ artist }: { artist: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <a href="#top" className="logo" aria-label={artist}>
        {artist.slice(0, 1)}
        <b>{artist.slice(1, 2)}</b>
        {artist.slice(2)}
      </a>
      <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Principal">
        {LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
      <button className="nav-toggle" aria-label="Menú" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? '✕' : '☰'}
      </button>
    </header>
  );
}
