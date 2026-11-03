import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

const schema = z.object({ current: z.string().min(1), next: z.string().min(10, 'Mínimo 10 caracteres') });

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const u = await q1<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [g.session.id]);
  if (!u || !(await bcrypt.compare(p.data.current, u.password_hash))) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
  }
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(p.data.next, 12), g.session.id]);
  return NextResponse.json({ ok: true });
}
