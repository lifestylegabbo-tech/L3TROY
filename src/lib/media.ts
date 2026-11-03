import { q, q1 } from './db';
import { DEFAULT_FORMATS, type AllowedFormats } from './config';

export type MediaRow = {
  id: string;
  bucket: string;
  path: string;
  name: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | string;
  width: number | null;
  height: number | null;
  duration_seconds: number | string | null;
  category: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  status: 'draft' | 'published' | 'archived';
  upload_state: 'uploading' | 'ready' | 'failed';
  section: string | null;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  sort_order: number;
  publish_at: string | null;
  poster_id: string | null;
  variants: Record<string, { path: string; width: number; height: number; size: number }>;
  upload_id: string | null;
  upload_error: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export const PUBLIC_FILTER = `m.status = 'published' AND m.upload_state = 'ready' AND (m.publish_at IS NULL OR m.publish_at <= now())`;

export async function getFormats(): Promise<AllowedFormats> {
  const row = await q1<{ value: Partial<AllowedFormats> }>("SELECT value FROM site_settings WHERE key = 'allowed_formats'");
  return { ...DEFAULT_FORMATS, ...(row?.value ?? {}) } as AllowedFormats;
}

export function slugify(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'archivo';
}

export function extOf(name: string) {
  const m = name.match(/\.([A-Za-z0-9]{1,5})$/);
  return m ? m[1].toLowerCase() : '';
}

export async function publishedBySection(section: string, limit = 60): Promise<MediaRow[]> {
  return q<MediaRow>(
    `SELECT m.* FROM media m WHERE m.section = $1 AND ${PUBLIC_FILTER} ORDER BY m.sort_order ASC, COALESCE(m.publish_at, m.created_at) DESC LIMIT $2`,
    [section, limit],
  );
}

export type PublicMedia = {
  id: string;
  kind: MediaRow['kind'];
  mime: string;
  title: string | null;
  description: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  hasPoster: boolean;
  smW: number | null;
  lgW: number | null;
};

export function toPublic(m: MediaRow): PublicMedia {
  return {
    id: m.id,
    kind: m.kind,
    mime: m.mime_type,
    title: m.title,
    description: m.description,
    alt: m.alt_text || m.title || m.name,
    width: m.width,
    height: m.height,
    duration: m.duration_seconds === null ? null : Number(m.duration_seconds),
    hasPoster: Boolean(m.variants?.poster),
    smW: m.variants?.sm?.width ?? null,
    lgW: m.variants?.lg?.width ?? null,
  };
}

export async function publicEvents() {
  return q<{ id: string; title: string; venue: string | null; city: string | null; event_date: string; ticket_url: string | null; description: string | null; cover_id: string | null }>(
    `SELECT e.id, e.title, e.venue, e.city, to_char(e.event_date,'YYYY-MM-DD') AS event_date, e.ticket_url, e.description,
            CASE WHEN m.id IS NOT NULL AND m.status='published' AND m.upload_state='ready' THEN e.cover_id END AS cover_id
     FROM events e LEFT JOIN media m ON m.id = e.cover_id
     WHERE e.published ORDER BY e.event_date DESC LIMIT 40`,
  );
}
