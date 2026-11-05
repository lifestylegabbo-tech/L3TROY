import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';

export async function GET() {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const rows = await q('SELECT id, email, name, role, active, created_at, last_login_at FROM users ORDER BY created_at ASC');
  return NextResponse.json({ users: rows });
}

const createSchema = z.object({
  email: z.string().email('Correo no válido'),
  name: z.string().min(2, 'Escribe un nombre'),
  role: z.enum(['admin', 'productor', 'manager']),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres'),
});

export async function POST(req: Request) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const p = createSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  try {
    const rows = await q(
      'INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, active, created_at',
      [p.data.email.toLowerCase(), p.data.name, p.data.role, await bcrypt.hash(p.data.password, 12)],
    );
    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (e) {
    if (String(e).includes('users_email_key')) return NextResponse.json({ error: 'Ese correo ya tiene una cuenta.' }, { status: 409 });
    throw e;
  }
}
