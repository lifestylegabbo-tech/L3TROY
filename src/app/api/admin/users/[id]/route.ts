import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['admin', 'productor', 'manager']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').optional(),
});

async function activeAdmins(excludeId: string) {
  const r = await q1<{ n: string }>("SELECT count(*)::text AS n FROM users WHERE role='admin' AND active AND id <> $1", [excludeId]);
  return Number(r?.n ?? 0);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const { id } = await params;
  const p = patchSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  const target = await q1<{ role: string; active: boolean }>('SELECT role, active FROM users WHERE id = $1', [id]);
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  const losesAdmin = target.role === 'admin' && ((p.data.role && p.data.role !== 'admin') || p.data.active === false);
  if (losesAdmin && (await activeAdmins(id)) === 0) {
    return NextResponse.json({ error: 'Debe quedar al menos un administrador activo.' }, { status: 400 });
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (p.data.name !== undefined) add('name', p.data.name);
  if (p.data.role !== undefined) add('role', p.data.role);
  if (p.data.active !== undefined) add('active', p.data.active);
  if (p.data.password !== undefined) add('password_hash', await bcrypt.hash(p.data.password, 12));
  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  vals.push(id);
  const rows = await q(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, email, name, role, active, created_at, last_login_at`,
    vals,
  );
  return NextResponse.json({ user: rows[0] });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const { id } = await params;
  if (id === g.session.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });
  const target = await q1<{ role: string }>('SELECT role FROM users WHERE id = $1', [id]);
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  if (target.role === 'admin' && (await activeAdmins(id)) === 0) {
    return NextResponse.json({ error: 'Debe quedar al menos un administrador activo.' }, { status: 400 });
  }
  await q('DELETE FROM users WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
