import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q1, q } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

const attempts = new Map<string, { n: number; t: number }>();
const DUMMY = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5qkU1H3sU2aXJ8WmVY8cV9b8l1b8q2S';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const rec = attempts.get(ip);
  if (rec && Date.now() - rec.t < 15 * 60_000 && rec.n >= 8) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Correo o contraseña no válidos.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const u = await q1<{ id: string; email: string; name: string; role: 'admin' | 'productor' | 'manager'; password_hash: string; active: boolean }>(
    'SELECT id, email, name, role, password_hash, active FROM users WHERE email = $1',
    [email],
  );
  const ok = await bcrypt.compare(parsed.data.password, u?.password_hash ?? DUMMY);
  if (!u || !ok || !u.active) {
    attempts.set(ip, { n: (rec && Date.now() - rec.t < 15 * 60_000 ? rec.n : 0) + 1, t: rec?.t ?? Date.now() });
    return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
  }
  attempts.delete(ip);
  await q('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
  await setSessionCookie({ id: u.id, email: u.email, name: u.name, role: u.role });
  return NextResponse.json({ ok: true, user: { name: u.name, role: u.role } });
}
