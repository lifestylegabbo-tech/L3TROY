import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;

export function s3() {
  if (!client) {
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error('Faltan variables de almacenamiento (S3_*)');
    }
    client = new S3Client({
      region: S3_REGION || 'us-east-1',
      endpoint: S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return client;
}

export async function presignPut(bucket: string, key: string, contentType: string, expiresIn = 900) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn });
}

export async function presignGet(bucket: string, key: string, opts: { expiresIn?: number; download?: string } = {}) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(opts.download ? { ResponseContentDisposition: `attachment; filename="${opts.download.replace(/"/g, '')}"` } : {}),
    }),
    { expiresIn: opts.expiresIn ?? 3600 },
  );
}

export async function createMultipart(bucket: string, key: string, contentType: string) {
  const r = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
  if (!r.UploadId) throw new Error('No se pudo iniciar la carga por partes');
  return r.UploadId;
}

export async function presignPart(bucket: string, key: string, uploadId: string, partNumber: number, expiresIn = 3600) {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn },
  );
}

export async function listParts(bucket: string, key: string, uploadId: string) {
  const parts: { PartNumber: number; ETag: string; Size: number }[] = [];
  let marker: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r = await s3().send(
      new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 }),
    );
    for (const p of r.Parts ?? []) {
      if (p.PartNumber && p.ETag) parts.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: Number(p.Size ?? 0) });
    }
    if (!r.IsTruncated) break;
    marker = r.NextPartNumberMarker;
  }
  return parts;
}

export async function completeMultipart(
  bucket: string,
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
) {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
    }),
  );
}

export async function abortMultipart(bucket: string, key: string, uploadId: string) {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

export async function headObject(bucket: string, key: string) {
  const r = await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { size: Number(r.ContentLength ?? 0), type: r.ContentType };
}

export async function deleteObject(bucket: string, key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function setCors(bucket: string, origins: string[]) {
  await s3().send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['GET', 'HEAD', 'PUT'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}

export async function copyObject(srcBucket: string, srcKey: string, dstBucket: string, dstKey: string) {
  const source = `${srcBucket}/${srcKey.split('/').map(encodeURIComponent).join('/')}`;
  await s3().send(new CopyObjectCommand({ Bucket: dstBucket, Key: dstKey, CopySource: source }));
}
