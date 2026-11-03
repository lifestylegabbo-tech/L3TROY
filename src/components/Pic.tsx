import type { PublicMedia } from '@/lib/media';

export function srcSet(m: PublicMedia) {
  const parts: string[] = [];
  if (m.smW) parts.push(`/api/media/${m.id}?v=sm ${m.smW}w`);
  if (m.lgW) parts.push(`/api/media/${m.id}?v=lg ${m.lgW}w`);
  return parts.join(', ') || undefined;
}

export function Pic({ m, sizes = '(max-width: 900px) 92vw, 50vw', priority = false, className }: { m: PublicMedia; sizes?: string; priority?: boolean; className?: string }) {
  const fallback = m.lgW ? `/api/media/${m.id}?v=lg` : `/api/media/${m.id}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fallback}
      srcSet={srcSet(m)}
      sizes={sizes}
      alt={m.alt}
      width={m.width ?? undefined}
      height={m.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  );
}

export function Placeholder({ label }: { label: string }) {
  return <div className="placeholder">{label}</div>;
}
