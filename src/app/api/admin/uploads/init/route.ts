import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { BUCKETS, PART_SIZE, MAX_PARTS, defaultBucket, kindOf, resolveMime } from '@/lib/config';
import { extOf, getFormats, slugify } from '@/lib/media';
import { createMultipart, presignPut } from '@/lib/s3';

const bucketIds = BUCKETS.map((b) => b.id) as string[];

const fileSchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().max(120).default(''),
  size: z.number().int().positive(),
  section: z.string().max(40).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  name: z.string().max(200).optional(),
});

const variantSchema = z.object({
  variantOf: z.string().uuid(),
  label: z.enum(['sm', 'lg', 'poster']),
});

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => null);

  // Versiones de visualización (miniaturas, portada de video): el original nunca se toca.
  const v = variantSchema.safeParse(body);
  if (v.success) {
    const parent = await q1<{ id: string; bucket: string; path: string; upload_state: string }>(
      'SELECT id, bucket, path, upload_state FROM media WHERE id = $1',
      [v.data.variantOf],
    );
    if (!parent) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });
    const dir = parent.path.split('/').slice(0, -1).join('/');
    const path = `${dir}/variants/${parent.id}-${v.data.label}.webp`;
    const putUrl = await presignPut(parent.bucket, path, 'image/webp');
    return NextResponse.json({ mode: 'variant', bucket: parent.bucket, path, putUrl });
  }

  const f = fileSchema.safeParse(body);
  if (!f.success) return NextResponse.json({ error: 'Datos del archivo no válidos.' }, { status: 400 });
  const formats = await getFormats();
  const mime = resolveMime(f.data.filename, f.data.mime);
  const kind = kindOf(mime, formats);
  if (!kind) {
    const ext = extOf(f.data.filename).toUpperCase() || 'desconocido';
    return NextResponse.json(
      { error: `El formato ${ext} no está permitido. Formatos válidos: JPG, PNG, WebP, TIFF, MP4, MOV, WebM, MP3, WAV, FLAC y PDF.` },
      { status: 415 },
    );
  }
  const max = formats.max_bytes?.[kind];
  if (max && f.data.size > max) {
    return NextResponse.json(
      { error: `El archivo pesa ${(f.data.size / 1048576).toFixed(0)} MB y el límite para ${kind === 'image' ? 'imágenes' : kind === 'video' ? 'videos' : kind === 'audio' ? 'audio' : 'documentos'} es ${(max / 1048576).toFixed(0)} MB.` },
      { status: 413 },
    );
  }
  const section = f.data.section || null;
  let bucket = f.data.category && bucketIds.includes(f.data.category) ? f.data.category : defaultBucket(kind, section);
  if (!bucketIds.includes(bucket)) bucket = 'promotional-media';

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const ext = extOf(f.data.filename);
  const path = `${kind}/${yyyy}/${mm}/${id}-${slugify(f.data.filename)}${ext ? '.' + ext : ''}`;

  const totalParts = Math.ceil(f.data.size / PART_SIZE);
  if (totalParts > MAX_PARTS) return NextResponse.json({ error: 'Archivo demasiado grande.' }, { status: 413 });
  const multipart = f.data.size > PART_SIZE;

  let uploadId: string | null = null;
  let putUrl: string | null = null;
  if (multipart) uploadId = await createMultipart(bucket, path, mime);
  else putUrl = await presignPut(bucket, path, mime);

  await q(
    `INSERT INTO media (id, bucket, path, name, original_filename, mime_type, size_bytes, category, kind, section, upload_id, uploaded_by, status, upload_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft','uploading')`,
    [id, bucket, path, f.data.name?.trim() || f.data.filename.replace(/\.[^.]+$/, ''), f.data.filename, mime, f.data.size, bucket, kind, section, uploadId, g.session.id],
  );

  return NextResponse.json({
    id,
    kind,
    contentType: mime,
    mode: multipart ? 'multipart' : 'single',
    bucket,
    path,
    uploadId,
    putUrl,
    partSize: PART_SIZE,
    totalParts: multipart ? totalParts : 1,
  });
}
