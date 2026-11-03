import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { BUCKETS } from '@/lib/config';
import { setCors } from '@/lib/s3';

/** Permite que el navegador suba directo al almacenamiento desde este sitio (se ejecuta una vez por dominio). */
export async function POST(req: Request) {
  const g = await guard(['admin']);
  if ('error' in g) return g.error;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const origins = Array.from(
    new Set([...(host ? [`${proto}://${host}`] : []), ...(process.env.SITE_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)]),
  );
  if (!origins.length) return NextResponse.json({ error: 'No se pudo determinar el dominio del sitio.' }, { status: 400 });
  const failed: string[] = [];
  for (const b of BUCKETS) {
    try {
      await setCors(b.id, origins);
    } catch {
      failed.push(b.id);
    }
  }
  if (failed.length) return NextResponse.json({ error: `No se pudo configurar: ${failed.join(', ')}` }, { status: 502 });
  return NextResponse.json({ ok: true, origins });
}
