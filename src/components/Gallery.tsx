'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicMedia } from '@/lib/media';
import { Pic } from './Pic';

export function VideoCard({ m, accent }: { m: PublicMedia; accent?: string }) {
  const [on, setOn] = useState(false);
  return (
    <figure className="vcard" style={accent ? ({ ['--accent' as string]: accent } as React.CSSProperties) : undefined}>
      {on ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={`/api/media/${m.id}`} poster={m.hasPoster ? `/api/media/${m.id}?v=poster` : undefined} controls autoPlay playsInline preload="auto" />
      ) : (
        <>
          {m.hasPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${m.id}?v=poster`} alt={m.alt} loading="lazy" decoding="async" />
          ) : (
            <div className="placeholder" style={{ minHeight: 0 }} />
          )}
          <button className="bigplay" onClick={() => setOn(true)} aria-label={`Reproducir ${m.title ?? 'video'}`}>
            <span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
          {m.title && <figcaption className="vt">{m.title}</figcaption>}
        </>
      )}
    </figure>
  );
}

function Lightbox({ items, index, onClose, onIndex }: { items: PublicMedia[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const m = items[index];
  const prev = useCallback(() => onIndex((index - 1 + items.length) % items.length), [index, items.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % items.length), [index, items.length, onIndex]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={m.title ?? 'Imagen'} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {m.kind === 'video' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={m.id} src={`/api/media/${m.id}`} controls autoPlay playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={`/api/media/${m.id}?v=lg`} onError={(e) => { (e.currentTarget as HTMLImageElement).src = `/api/media/${m.id}`; }} alt={m.alt} />
        )}
      </div>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Cerrar">✕</button>
      {items.length > 1 && (
        <>
          <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Anterior">‹</button>
          <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Siguiente">›</button>
        </>
      )}
      {(m.title || m.description) && (
        <div className="lb-cap">
          <b>{m.title}</b> {m.description && <span className="muted">· {m.description}</span>}
        </div>
      )}
    </div>
  );
}

export function Masonry({ items }: { items: PublicMedia[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <div className="masonry">
        {items.map((m, i) => (
          <button key={m.id} className="frame" onClick={() => setOpen(i)} aria-label={`Abrir ${m.alt}`}>
            {m.kind === 'video' ? (
              m.hasPoster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${m.id}?v=poster`} alt={m.alt} loading="lazy" decoding="async" />
              ) : (
                <div className="placeholder">Video</div>
              )
            ) : (
              <Pic m={m} sizes="(max-width: 560px) 48vw, (max-width: 900px) 46vw, 30vw" />
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox items={items} index={open} onClose={close} onIndex={setOpen} />}
    </>
  );
}
