import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { abortMultipart, deleteObject } from '@/lib/s3';

const schema = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  const m = await q1<{ bucket: string; path: string; upload_id: string | null; upload_state: string }>(
    'SELECT bucket, path, upload_id, upload_state FROM media WHERE id = $1',
    [p.data.id],
  );
  if (!m) return NextResponse.json({ ok: true });
  if (m.upload_state === 'ready') return NextResponse.json({ error: 'El archivo ya se subió; elimínalo desde la biblioteca.' }, { status: 409 });
  try {
    if (m.upload_id) await abortMultipart(m.bucket, m.path, m.upload_id);
    else await deleteObject(m.bucket, m.path);
  } catch {
    /* si el objeto no existe todavía, no pasa nada */
  }
  await q('DELETE FROM media WHERE id = $1 AND upload_state <> $2', [p.data.id, 'ready']);
  return NextResponse.json({ ok: true });
}
