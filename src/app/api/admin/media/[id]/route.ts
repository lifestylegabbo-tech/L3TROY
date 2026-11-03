import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { BUCKETS, SECTIONS } from '@/lib/config';
import { copyObject, deleteObject, abortMultipart } from '@/lib/s3';
import type { MediaRow } from '@/lib/media';

type Ctx = { params: Promise<{ id: string }> };
const bucketIds = BUCKETS.map((b) => b.id) as string[];
const sectionIds = SECTIONS.map((s) => s.id) as string[];

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  alt_text: z.string().max(300).nullable().optional(),
  section: z.string().nullable().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  sort_order: z.number().int().optional(),
});

async function variantPaths(m: Pick<MediaRow, 'variants'>) {
  return Object.values(m.variants ?? {}).map((v) => v.path);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  const p = patchSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  const d = p.data;
  const m = await q1<MediaRow>('SELECT * FROM media WHERE id = $1', [id]);
  if (!m) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });
  if (d.section !== undefined && d.section !== null && !sectionIds.includes(d.section)) {
    return NextResponse.json({ error: 'Sección no válida.' }, { status: 400 });
  }
  if (d.status === 'published') {
    if (m.upload_state !== 'ready') return NextResponse.json({ error: 'El archivo todavía se está subiendo.' }, { status: 409 });
    const sec = d.section !== undefined ? d.section : m.section;
    if (!sec) return NextResponse.json({ error: 'Elige en qué sección aparecerá antes de publicar.' }, { status: 400 });
  }

  // Cambio de categoría = mover el archivo (y sus versiones) a otro bucket sin alterar el original.
  let newBucket = m.bucket;
  if (d.category && d.category !== m.bucket) {
    if (!bucketIds.includes(d.category)) return NextResponse.json({ error: 'Categoría no válida.' }, { status: 400 });
    if (m.upload_state !== 'ready') return NextResponse.json({ error: 'Espera a que termine la subida.' }, { status: 409 });
    newBucket = d.category;
    await copyObject(m.bucket, m.path, newBucket, m.path);
    for (const vp of await variantPaths(m)) await copyObject(m.bucket, vp, newBucket, vp);
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  for (const k of ['name', 'title', 'description', 'alt_text', 'section', 'status', 'publish_at', 'sort_order'] as const) {
    if (d[k] !== undefined) add(k, d[k]);
  }
  if (newBucket !== m.bucket) {
    add('bucket', newBucket);
    add('category', newBucket);
  }
  if (!sets.length) return NextResponse.json({ item: m });
  vals.push(id);
  const rows = await q(`UPDATE media SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);

  if (newBucket !== m.bucket) {
    // el registro ya apunta al bucket nuevo; limpiar el anterior
    await deleteObject(m.bucket, m.path).catch(() => {});
    for (const vp of await variantPaths(m)) await deleteObject(m.bucket, vp).catch(() => {});
  }
  return NextResponse.json({ item: rows[0] });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  const confirm = new URL(req.url).searchParams.get('confirm') === '1';
  const m = await q1<MediaRow>('SELECT * FROM media WHERE id = $1', [id]);
  if (!m) return NextResponse.json({ ok: true });

  const usage: string[] = [];
  if (m.status === 'published' && m.section) {
    const label = SECTIONS.find((s) => s.id === m.section)?.label ?? m.section;
    usage.push(`Publicado en la sección «${label}» de la landing`);
  }
  const ev = await q<{ title: string }>('SELECT title FROM events WHERE cover_id = $1', [id]);
  for (const e of ev) usage.push(`Portada del evento «${e.title}»`);

  if (usage.length && !confirm) {
    return NextResponse.json({ error: 'Este archivo está en uso.', inUse: true, usage }, { status: 409 });
  }
  try {
    if (m.upload_id && m.upload_state !== 'ready') await abortMultipart(m.bucket, m.path, m.upload_id).catch(() => {});
    await deleteObject(m.bucket, m.path).catch(() => {});
    for (const vp of await variantPaths(m)) await deleteObject(m.bucket, vp).catch(() => {});
  } finally {
    // la fila se elimina siempre: la landing solo lee filas publicadas, así que no quedan enlaces rotos
    await q('DELETE FROM media WHERE id = $1', [id]);
  }
  return NextResponse.json({ ok: true });
}
