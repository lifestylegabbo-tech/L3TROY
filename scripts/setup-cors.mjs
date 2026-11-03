import { readFileSync } from 'node:fs';
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv('.env.local');

const origins = (process.env.SITE_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean);
const buckets = ['artist-branding','artist-photography','events','event-videos','music-sets','promotional-media','collaborations','documents'];
const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

for (const Bucket of buckets) {
  await s3.send(new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: { CORSRules: [{
      AllowedOrigins: origins,
      AllowedMethods: ['GET', 'HEAD', 'PUT'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
      MaxAgeSeconds: 3600,
    }] },
  }));
  const r = await s3.send(new GetBucketCorsCommand({ Bucket }));
  console.log(Bucket, 'CORS ->', r.CORSRules?.[0]?.AllowedOrigins?.join(', '));
}
