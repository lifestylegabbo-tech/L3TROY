import { NextResponse } from 'next/server';
import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { upsertClient } from '@/lib/quotes';

const hits = new Map<string, number[]>();

const schema = z
  .object({
    name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
    email: z.string().trim().email('Correo no válido').max(160).optional().or(z.literal('')),
    phone: z.string().trim().max(40).optional(),
    service_id: z.string().uuid().optional().or(z.literal('')),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').optional().or(z.literal('')),
    venue: z.string().trim().max(160).optional(),
    city: z.string().trim().max(100).optional(),
    guests: z.coerce.number().int().min(1).max(100000).optional().or(z.literal('').transform(() => undefined)),
    message: z.string().trim().max(2000).optional(),
    website: z.string().optional(), // trampa para bots
  })
  .refine((d) => d.email || d.phone, { message: 'Déjanos un correo o un teléfono para responderte.', path: ['email'] });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return NextResponse.json({ error: 'Has enviado varias solicitudes. Intenta de nuevo en unos minutos.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const d = p.data;
  if (d.website) return NextResponse.json({ ok: true, number: 'COT-0000' }); // bot: respuesta falsa
  if (d.event_date && d.event_date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'La fecha del evento ya pasó.' }, { status: 400 });
  }

  // Límite por correo: 3 solicitudes por hora
  if (d.email) {
    const n = await q1<{ n: string }>(
      `SELECT count(*)::text AS n FROM quotes qt JOIN clients c ON c.id = qt.client_id
       WHERE lower(c.email) = $1 AND qt.source = 'landing' AND qt.created_at > now() - interval '1 hour'`,
      [d.email.toLowerCase()],
    );
    if (Number(n?.n ?? 0) >= 3) return NextResponse.json({ error: 'Ya recibimos tus solicitudes. Te responderemos pronto.' }, { status: 429 });
  }

  const service = d.service_id ? await q1<{ id: string; name: string }>('SELECT id, name FROM services WHERE id = $1 AND active', [d.service_id]) : null;
  const clientId = await upsertClient({ name: d.name, email: d.email, phone: d.phone }, 'landing');
  const row = await q1<{ number: string }>(
    `INSERT INTO quotes (client_id, status, service_id, service_name, event_date, venue, city, guests, message, source)
     VALUES ($1,'nueva',$2,$3,$4,$5,$6,$7,$8,'landing') RETURNING number`,
    [clientId, service?.id ?? null, service?.name ?? null, d.event_date || null, d.venue || null, d.city || null, d.guests ?? null, d.message || null],
  );
  hits.set(ip, [...recent, now]);
  return NextResponse.json({ ok: true, number: row!.number }, { status: 201 });
}
