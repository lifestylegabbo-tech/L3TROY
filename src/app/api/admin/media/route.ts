import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';

export async function GET(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const u = new URL(req.url);
  const where: string[] = [];
  const vals: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    vals.push(v);
    where.push(sql.replace('?', `$${vals.length}`));
  };
  const section = u.searchParams.get('section');
  const status = u.searchParams.get('status');
  const category = u.searchParams.get('category');
  const kind = u.searchParams.get('kind');
  const search = u.searchParams.get('q');
  if (section === 'none') where.push('m.section IS NULL');
  else if (section) add('m.section = ?', section);
  if (status) add('m.status = ?', status);
  if (category) add('m.category = ?', category);
  if (kind) add('m.kind = ?', kind);
  if (search) {
    vals.push(`%${search}%`);
    const n = vals.length;
    where.push(`(m.name ILIKE $${n} OR m.title ILIKE $${n} OR m.original_filename ILIKE $${n})`);
  }
  const sqlWhere = where.join(' AND ');
  const limit = Math.min(Number(u.searchParams.get('limit') ?? 60), 200);
  const offset = Math.max(Number(u.searchParams.get('offset') ?? 0), 0);
  const rows = await q(
    `SELECT m.*, u.name AS uploaded_by_name FROM media m LEFT JOIN users u ON u.id = m.uploaded_by
     ${sqlWhere ? 'WHERE ' + sqlWhere : ''} ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    vals,
  );
  return NextResponse.json({ items: rows });
}
