import { NextResponse } from 'next/server';
import { q1 } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { presignGet } from '@/lib/s3';
import { PUBLIC_FILTER, type MediaRow } from '@/lib/media';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Entrega archivos sin exponer los buckets: valida que el recurso esté publicado
 * (o que quien lo pide tenga sesión) y redirige a una URL firmada de corta duración.
 *  ?v=sm|lg|poster  versión de visualización     ?download=1  original (solo con sesión)
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    return await serve(req, ctx);
  } catch {
    return new NextResponse('Servicio no disponible', { status: 503 });
  }
}

async function serve(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('No encontrado', { status: 404 });
  const url = new URL(req.url);
  const variant = url.searchParams.get('v');
  const download = url.searchParams.get('download') === '1';

  const pub = await q1<MediaRow>(`SELECT m.* FROM media m WHERE m.id = $1 AND ${PUBLIC_FILTER}`, [id]);
  let row = pub;
  let isPrivateView = false;
  if (!row || download) {
    const s = await getSession();
    if (!s) return new NextResponse('No encontrado', { status: 404 });
    row = await q1<MediaRow>('SELECT * FROM media WHERE id = $1 AND upload_state = $2', [id, 'ready']);
    isPrivateView = true;
  }
  if (!row) return new NextResponse('No encontrado', { status: 404 });

  let key = row.path;
  if (variant && row.variants?.[variant]) key = row.variants[variant].path;
  else if (variant === 'poster') return new NextResponse('Sin portada', { status: 404 });

  const signed = await presignGet(row.bucket, key, {
    expiresIn: 3600,
    download: download ? row.original_filename : undefined,
  });
  const res = NextResponse.redirect(signed, 302);
  res.headers.set(
    'Cache-Control',
    isPrivateView ? 'private, no-store' : 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
  );
  return res;
}
