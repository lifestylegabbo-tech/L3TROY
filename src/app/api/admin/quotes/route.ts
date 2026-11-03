import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { cleanItems, totalOf, upsertClient } from '@/lib/quotes';

const SELECT = `SELECT qt.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone
  FROM quotes qt LEFT JOIN clients c ON c.id = qt.client_id`;

export async function GET(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const u = new URL(req.url);
  const status = u.searchParams.get('status');
  const search = u.searchParams.get('q')?.trim();
  const where: string[] = [];
  const vals: unknown[] = [];
  if (status) {
    vals.push(status);
    where.push(`qt.status = $${vals.length}`);
  }
  if (search) {
    vals.push(`%${search}%`);
    where.push(`(qt.number ILIKE $${vals.length} OR c.name ILIKE $${vals.length} OR c.email ILIKE $${vals.length} OR qt.venue ILIKE $${vals.length})`);
  }
  const rows = await q(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY qt.created_at DESC LIMIT 300`, vals);
  const counts = await q<{ status: string; n: string }>('SELECT status, count(*)::text AS n FROM quotes GROUP BY status');
  return NextResponse.json({ quotes: rows, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
}

const schema = z.object({
  client_id: z.string().uuid().optional(),
  new_client: z.object({ name: z.string().min(2), email: z.string().email().optional().or(z.literal('')), phone: z.string().optional(), company: z.string().optional() }).optional(),
  service_id: z.string().uuid().optional().or(z.literal('')),
  event_date: z.string().optional().or(z.literal('')),
  venue: z.string().max(160).optional(),
  city: z.string().max(100).optional(),
  guests: z.coerce.number().int().min(0).optional(),
  message: z.string().max(2000).optional(),
  items: z.array(z.any()).optional(),
  currency: z.enum(['GTQ', 'USD']).optional(),
  valid_until: z.string().optional().or(z.literal('')),
  internal_notes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const d = p.data;
  let clientId = d.client_id ?? null;
  if (!clientId && d.new_client) clientId = await upsertClient(d.new_client, 'admin');
  if (!clientId) return NextResponse.json({ error: 'Elige un cliente o crea uno nuevo.' }, { status: 400 });
  const service = d.service_id ? await q1<{ id: string; name: string }>('SELECT id, name FROM services WHERE id = $1', [d.service_id]) : null;
  const items = cleanItems(d.items);
  const row = await q1<{ id: string }>(
    `INSERT INTO quotes (client_id, status, service_id, service_name, event_date, venue, city, guests, message, items, total, currency, valid_until, internal_notes, source)
     VALUES ($1,'en_revision',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'admin') RETURNING id`,
    [clientId, service?.id ?? null, service?.name ?? null, d.event_date || null, d.venue || null, d.city || null, d.guests || null, d.message || null, JSON.stringify(items), totalOf(items), d.currency ?? 'GTQ', d.valid_until || null, d.internal_notes || null],
  );
  const full = await q1(`${SELECT} WHERE qt.id = $1`, [row!.id]);
  return NextResponse.json({ quote: full }, { status: 201 });
}
