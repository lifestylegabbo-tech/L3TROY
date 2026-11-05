import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { q1 } from './db';

export const COOKIE = 'l3_session';
export type Role = 'admin' | 'productor' | 'manager';
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', productor: 'Productor', manager: 'Manager' };
export type Session = { id: string; email: string; name: string; role: Role };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET inválida');
  return new TextEncoder().encode(s);
}

export async function signSession(u: Session) {
  return new SignJWT({ email: u.email, name: u.name, role: u.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key());
}

export async function setSessionCookie(u: Session) {
  const token = await signSession(u);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Lee la sesión y confirma contra la base de datos que el usuario siga activo. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const id = payload.sub;
    if (!id) return null;
    const u = await q1<{ id: string; email: string; name: string; role: Role; active: boolean }>(
      'SELECT id, email, name, role, active FROM users WHERE id = $1',
      [id],
    );
    if (!u || !u.active) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  } catch {
    return null;
  }
}

export async function guard(roles: Role[] = ['admin', 'productor', 'manager']) {
  const s = await getSession();
  if (!s) return { error: NextResponse.json({ error: 'Sesión no válida. Inicia sesión de nuevo.' }, { status: 401 }) } as const;
  if (!roles.includes(s.role)) {
    return { error: NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 }) } as const;
  }
  return { session: s } as const;
}
