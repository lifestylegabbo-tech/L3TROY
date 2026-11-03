import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { eventSchema } from '../route';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  const p = eventSchema.partial().safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(p.data)) {
    if (v === undefined) continue;
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  vals.push(id);
  const rows = await q(`UPDATE events SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return NextResponse.json({ event: rows[0] });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  await q('DELETE FROM events WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
