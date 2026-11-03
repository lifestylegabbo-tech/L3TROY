import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { cleanItems, totalOf } from '@/lib/quotes';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(['nueva', 'en_revision', 'enviada', 'aceptada', 'rechazada', 'vencida']).optional(),
  client_id: z.string().uuid().optional(),
  service_name: z.string().max(160).optional(),
  event_date: z.string().optional().or(z.literal('')),
  venue: z.string().max(160).optional(),
  city: z.string().max(100).optional(),
  guests: z.coerce.number().int().min(0).optional().or(z.literal('').transform(() => 0)),
  message: z.string().max(2000).optional(),
  items: z.array(z.any()).optional(),
  currency: z.enum(['GTQ', 'USD']).optional(),
  valid_until: z.string().optional().or(z.literal('')),
  internal_notes: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const d = p.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (d.status !== undefined) add('status', d.status);
  if (d.client_id !== undefined) add('client_id', d.client_id);
  if (d.service_name !== undefined) add('service_name', d.service_name || null);
  if (d.event_date !== undefined) add('event_date', d.event_date || null);
  if (d.venue !== undefined) add('venue', d.venue || null);
  if (d.city !== undefined) add('city', d.city || null);
  if (d.guests !== undefined) add('guests', d.guests || null);
  if (d.message !== undefined) add('message', d.message || null);
  if (d.currency !== undefined) add('currency', d.currency);
  if (d.valid_until !== undefined) add('valid_until', d.valid_until || null);
  if (d.internal_notes !== undefined) add('internal_notes', d.internal_notes || null);
  if (d.items !== undefined) {
    const items = cleanItems(d.items);
    add('items', JSON.stringify(items));
    add('total', totalOf(items));
  }
  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  vals.push(id);
  const r = await q(`UPDATE quotes SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`, vals);
  if (!r.length) return NextResponse.json({ error: 'Cotización no encontrada.' }, { status: 404 });
  const full = await q1(
    `SELECT qt.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone FROM quotes qt LEFT JOIN clients c ON c.id = qt.client_id WHERE qt.id = $1`,
    [id],
  );
  return NextResponse.json({ quote: full });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const { id } = await params;
  await q('DELETE FROM quotes WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
