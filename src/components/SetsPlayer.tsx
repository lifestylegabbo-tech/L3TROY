'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicMedia } from '@/lib/media';
import Visualizer from './Visualizer';
import { Placeholder } from './Pic';

function fmt(s: number) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function SetsPlayer({ tracks }: { tracks: PublicMedia[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const noCors = useRef(false);

  const current = tracks[idx];

  const ensureAnalyser = useCallback(() => {
    const el = audioRef.current;
    if (!el || ctxRef.current || noCors.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(el);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.82;
      src.connect(an);
      an.connect(ctx.destination);
      ctxRef.current = ctx;
      setAnalyser(an);
    } catch {
      /* el visualizador cae a la animación sintética */
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => setDur(el.duration);
    const onPlay = () => {
      setPlaying(true);
      ensureAnalyser();
      ctxRef.current?.resume();
    };
    const onPause = () => setPlaying(false);
    const onEnd = () => setIdx((i) => (i + 1 < tracks.length ? i + 1 : i));
    const onErr = () => {
      // Si el navegador bloqueó la carga por CORS, reintentamos sin analizador.
      if (el.crossOrigin && !noCors.current) {
        noCors.current = true;
        el.removeAttribute('crossorigin');
        const t = el.currentTime;
        el.load();
        el.currentTime = t;
        el.play().catch(() => {});
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onErr);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onErr);
    };
  }, [ensureAnalyser, tracks.length]);

  // Al cambiar de pista por fin de reproducción, continúa sonando.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    audioRef.current?.play().catch(() => {});
  }, [idx]);

  if (!tracks.length) {
    return (
      <div className="frame" style={{ minHeight: 280 }}>
        <Placeholder label="Próximamente · nuevos sets" />
      </div>
    );
  }

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };
  const pick = (i: number) => {
    if (i === idx) return toggle();
    setIdx(i);
    setTime(0);
    setDur(0);
  };

  return (
    <div className="sets-layout">
      <div className="deck">
        <div className="deck-top">
          <div className={`jog ${playing ? 'on' : ''}`} aria-hidden />
          <div className="deck-meta">
            <h3>{current.title || 'Set'}</h3>
            <p>{current.description || 'L3TROY · en vivo desde el estudio'}</p>
          </div>
        </div>
        <div className="deck-viz">
          <Visualizer analyser={analyser} active={playing} bars={72} />
        </div>
        <div className="deck-controls">
          <button className="play" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <input
            className="seek"
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={time}
            aria-label="Posición"
            style={{ ['--v' as string]: `${dur ? (time / dur) * 100 : 0}%` }}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = v;
              setTime(v);
            }}
          />
          <span className="time">
            {fmt(time)} / {fmt(dur || current.duration || 0)}
          </span>
        </div>
        <audio ref={audioRef} key="player" src={`/api/media/${current.id}`} preload="none" crossOrigin="anonymous" />
      </div>

      <ol className="tracklist">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button className={`track ${i === idx ? 'active' : ''} ${i === idx && playing ? 'playing' : ''}`} onClick={() => pick(i)}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="t">
                <b>{t.title || 'Sin título'}</b>
                <span>{t.description || (t.duration ? fmt(t.duration) : 'Set')}</span>
              </span>
              <span className="eq" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
