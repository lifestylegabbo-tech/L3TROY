import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { PART_SIZE } from '@/lib/config';
import { presignPart } from '@/lib/s3';

const schema = z.object({ id: z.string().uuid(), partNumber: z.number().int().min(1).max(10000) });

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  const m = await q1<{ bucket: string; path: string; upload_id: string | null; upload_state: string; size_bytes: string }>(
    'SELECT bucket, path, upload_id, upload_state, size_bytes FROM media WHERE id = $1',
    [p.data.id],
  );
  if (!m || !m.upload_id || m.upload_state === 'ready') return NextResponse.json({ error: 'La carga ya no está activa.' }, { status: 410 });
  const total = Math.ceil(Number(m.size_bytes) / PART_SIZE);
  if (p.data.partNumber > total) return NextResponse.json({ error: 'Parte fuera de rango.' }, { status: 400 });
  const url = await presignPart(m.bucket, m.path, m.upload_id, p.data.partNumber);
  return NextResponse.json({ url });
}
