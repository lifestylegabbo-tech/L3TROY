import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { completeMultipart, deleteObject, headObject } from '@/lib/s3';
import { getFormats } from '@/lib/media';

const schema = z.object({
  id: z.string().uuid(),
  parts: z.array(z.object({ PartNumber: z.number().int(), ETag: z.string() })).optional(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  duration: z.number().positive().nullish(),
  variant: z
    .object({
      label: z.enum(['sm', 'lg', 'poster']),
      path: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      size: z.number().int().nonnegative(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  const d = p.data;
  const m = await q1<{ bucket: string; path: string; upload_id: string | null; upload_state: string; kind: 'image' | 'video' | 'audio' | 'document' }>(
    'SELECT bucket, path, upload_id, upload_state, kind FROM media WHERE id = $1',
    [d.id],
  );
  if (!m) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });

  if (d.variant) {
    const dir = m.path.split('/').slice(0, -1).join('/');
    if (!d.variant.path.startsWith(`${dir}/variants/`)) return NextResponse.json({ error: 'Ruta no válida.' }, { status: 400 });
    await q(
      `UPDATE media SET variants = jsonb_set(variants, ARRAY[$2::text], $3::jsonb), updated_at = now() WHERE id = $1`,
      [d.id, d.variant.label, JSON.stringify({ path: d.variant.path, width: d.variant.width, height: d.variant.height, size: d.variant.size })],
    );
    return NextResponse.json({ ok: true });
  }

  if (m.upload_state === 'ready') return NextResponse.json({ ok: true });
  try {
    if (m.upload_id) {
      if (!d.parts?.length) return NextResponse.json({ error: 'Faltan las partes de la carga.' }, { status: 400 });
      await completeMultipart(m.bucket, m.path, m.upload_id, d.parts);
    }
    const head = await headObject(m.bucket, m.path);
    const formats = await getFormats();
    const max = formats.max_bytes?.[m.kind];
    if (max && head.size > max) {
      await deleteObject(m.bucket, m.path);
      await q("UPDATE media SET upload_state='failed', upload_error=$2 WHERE id=$1", [d.id, 'Excede el tamaño permitido']);
      return NextResponse.json({ error: 'El archivo excede el tamaño permitido.' }, { status: 413 });
    }
    await q(
      `UPDATE media SET upload_state='ready', upload_id=NULL, upload_error=NULL, size_bytes=$2, width=$3, height=$4, duration_seconds=$5, updated_at=now() WHERE id=$1`,
      [d.id, head.size, d.width ?? null, d.height ?? null, d.duration ?? null],
    );
    return NextResponse.json({ ok: true, size: head.size });
  } catch (e) {
    await q("UPDATE media SET upload_state='failed', upload_error=$2 WHERE id=$1", [d.id, String(e).slice(0, 300)]);
    return NextResponse.json({ error: 'No se pudo finalizar la carga. Intenta de nuevo.' }, { status: 502 });
  }
}
