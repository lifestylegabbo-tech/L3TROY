import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('Correo no válido').max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  notes: z.string().max(2000).optional(),
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
    vals.push(k === 'name' ? v : k === 'email' ? (v as string).toLowerCase() || null : v || null);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  vals.push(id);
  try {
    const row = await q1(`UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
    if (!row) return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    return NextResponse.json({ client: row });
  } catch (e) {
    if (String(e).includes('clients_email_uq')) return NextResponse.json({ error: 'Ya existe un cliente con ese correo.' }, { status: 409 });
    throw e;
  }
}

/** Borrar un cliente con cotizaciones exige ?confirm=1; las cotizaciones se conservan sin cliente asignado. */
export async function DELETE(req: Request, { params }: Ctx) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const { id } = await params;
  const n = await q1<{ n: string }>('SELECT count(*)::text AS n FROM quotes WHERE client_id = $1', [id]);
  const count = Number(n?.n ?? 0);
  if (count > 0 && new URL(req.url).searchParams.get('confirm') !== '1') {
    return NextResponse.json({ error: `Este cliente tiene ${count} cotización(es).`, quotes: count }, { status: 409 });
  }
  await q('DELETE FROM clients WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
