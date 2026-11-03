import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';

export const eventSchema = z.object({
  title: z.string().min(2).max(160),
  venue: z.string().max(160).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ticket_url: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  description: z.string().max(1000).nullable().optional(),
  cover_id: z.string().uuid().nullable().optional(),
  published: z.boolean().optional(),
});

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const rows = await q('SELECT * FROM events ORDER BY event_date DESC');
  return NextResponse.json({ events: rows });
}

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = eventSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Revisa los datos del evento (título y fecha son obligatorios).' }, { status: 400 });
  const d = p.data;
  const rows = await q(
    `INSERT INTO events (title, venue, city, event_date, ticket_url, description, cover_id, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [d.title, d.venue ?? null, d.city ?? null, d.event_date, d.ticket_url ?? null, d.description ?? null, d.cover_id ?? null, d.published ?? false],
  );
  return NextResponse.json({ event: rows[0] }, { status: 201 });
}
