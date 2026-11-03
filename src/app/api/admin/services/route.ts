import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  return NextResponse.json({ services: await q('SELECT * FROM services ORDER BY sort, created_at') });
}

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del servicio').max(120),
  description: z.string().max(300).optional(),
  base_price: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
});

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const row = await q1(
    `INSERT INTO services (name, description, base_price, sort) VALUES ($1,$2,$3,(SELECT COALESCE(max(sort),0)+1 FROM services)) RETURNING *`,
    [p.data.name, p.data.description || null, p.data.base_price ?? null],
  );
  return NextResponse.json({ service: row }, { status: 201 });
}
