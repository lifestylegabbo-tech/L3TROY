import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

export async function GET(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const search = new URL(req.url).searchParams.get('q')?.trim();
  const rows = await q(
    `SELECT c.*, (SELECT count(*) FROM quotes WHERE client_id = c.id)::int AS quotes_count
     FROM clients c ${search ? `WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1 OR c.company ILIKE $1` : ''}
     ORDER BY c.created_at DESC LIMIT 500`,
    search ? [`%${search}%`] : [],
  );
  return NextResponse.json({ clients: rows });
}

export const clientSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del cliente').max(120),
  email: z.string().trim().email('Correo no válido').max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = clientSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const d = p.data;
  try {
    const row = await q1(
      'INSERT INTO clients (name, email, phone, company, notes, source) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [d.name, d.email?.toLowerCase() || null, d.phone || null, d.company || null, d.notes || null, 'admin'],
    );
    return NextResponse.json({ client: row }, { status: 201 });
  } catch (e) {
    if (String(e).includes('clients_email_uq')) return NextResponse.json({ error: 'Ya existe un cliente con ese correo.' }, { status: 409 });
    throw e;
  }
}
