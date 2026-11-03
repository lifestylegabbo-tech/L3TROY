import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { q1, q } from '@/lib/db';
import { listParts } from '@/lib/s3';

export async function GET(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  const m = await q1<{ bucket: string; path: string; upload_id: string | null; upload_state: string }>(
    'SELECT bucket, path, upload_id, upload_state FROM media WHERE id = $1',
    [id],
  );
  if (!m || !m.upload_id || m.upload_state === 'ready') return NextResponse.json({ error: 'No hay carga para reanudar.' }, { status: 410 });
  try {
    const parts = await listParts(m.bucket, m.path, m.upload_id);
    await q("UPDATE media SET upload_state = 'uploading', upload_error = NULL WHERE id = $1", [id]);
    return NextResponse.json({ parts });
  } catch {
    return NextResponse.json({ error: 'La carga expiró. Vuelve a iniciar el archivo.' }, { status: 410 });
  }
}
