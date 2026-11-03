import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q1 } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(300).optional(),
  base_price: z.coerce.number().min(0).nullable().optional().or(z.literal('').transform(() => null)),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(p.data)) {
    if (v === undefined) continue;
    vals.push(v === '' ? null : v);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  vals.push(id);
  const row = await q1(`UPDATE services SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!row) return NextResponse.json({ error: 'Servicio no encontrado.' }, { status: 404 });
  return NextResponse.json({ service: row });
}

/** Las cotizaciones guardan el nombre del servicio, así que borrar uno no deja datos rotos. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const { id } = await params;
  await q1('DELETE FROM services WHERE id = $1 RETURNING id', [id]);
  return NextResponse.json({ ok: true });
}
