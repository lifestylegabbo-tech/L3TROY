import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { DEFAULT_CONTENT, getContent } from '@/lib/content';
import { getFormats } from '@/lib/media';

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  return NextResponse.json({ content: await getContent(), formats: await getFormats(), defaults: DEFAULT_CONTENT });
}

const contentKeys = Object.keys(DEFAULT_CONTENT) as (keyof typeof DEFAULT_CONTENT)[];
const contentSchema = z.object(Object.fromEntries(contentKeys.map((k) => [k, z.string().max(1500).optional()]))).partial();
const formatsSchema = z.object({
  image: z.array(z.string()),
  video: z.array(z.string()),
  audio: z.array(z.string()),
  document: z.array(z.string()),
  max_bytes: z.object({
    image: z.number().int().positive(),
    video: z.number().int().positive(),
    audio: z.number().int().positive(),
    document: z.number().int().positive(),
  }),
});

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const g = await guard(body?.formats ? ['admin'] : ['admin', 'productor', 'manager']);
  if ('error' in g) return g.error;
  const p = z.object({ content: contentSchema.optional(), formats: formatsSchema.optional() }).safeParse(body);
  if (!p.success) return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  if (p.data.content) {
    const merged = { ...(await getContent()), ...p.data.content };
    await q(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ('content', $1::jsonb, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(merged), g.session.id],
    );
  }
  if (p.data.formats) {
    await q(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ('allowed_formats', $1::jsonb, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(p.data.formats), g.session.id],
    );
  }
  return NextResponse.json({ ok: true });
}
