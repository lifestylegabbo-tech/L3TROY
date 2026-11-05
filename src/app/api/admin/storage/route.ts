import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { BUCKETS } from '@/lib/config';

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const totals = await q1<{ files: string; bytes: string; variant_bytes: string; images: string; videos: string; audio: string; docs: string; uploading: string; failed: string }>(
    `SELECT count(*)::text AS files,
            COALESCE(sum(size_bytes),0)::text AS bytes,
            COALESCE(sum((SELECT COALESCE(sum((v.value->>'size')::bigint),0) FROM jsonb_each(variants) v)),0)::text AS variant_bytes,
            count(*) FILTER (WHERE kind='image')::text AS images,
            count(*) FILTER (WHERE kind='video')::text AS videos,
            count(*) FILTER (WHERE kind='audio')::text AS audio,
            count(*) FILTER (WHERE kind='document')::text AS docs,
            count(*) FILTER (WHERE upload_state='uploading')::text AS uploading,
            count(*) FILTER (WHERE upload_state='failed')::text AS failed
     FROM media WHERE upload_state <> 'failed' OR true`,
  );
  const heavy = await q(
    `SELECT id, name, kind, category, size_bytes, status FROM media WHERE upload_state='ready' ORDER BY size_bytes DESC LIMIT 10`,
  );
  const byBucket = await q<{ category: string; files: string; bytes: string }>(
    `SELECT category, count(*)::text AS files, COALESCE(sum(size_bytes),0)::text AS bytes FROM media WHERE upload_state='ready' GROUP BY category`,
  );
  const used = Number(totals?.bytes ?? 0) + Number(totals?.variant_bytes ?? 0);
  const alerts: { level: 'warn' | 'danger'; message: string }[] = [];
  if (Number(totals?.failed ?? 0) > 0) alerts.push({ level: 'warn', message: `Hay ${totals?.failed} subidas fallidas que ocupan registro. Reintenta o elimínalas.` });

  return NextResponse.json({
    usedBytes: used,
    originalBytes: Number(totals?.bytes ?? 0),
    variantBytes: Number(totals?.variant_bytes ?? 0),
    quotaBytes: null,
    quotaConfigured: false,
    counts: {
      files: Number(totals?.files ?? 0),
      images: Number(totals?.images ?? 0),
      videos: Number(totals?.videos ?? 0),
      audio: Number(totals?.audio ?? 0),
      documents: Number(totals?.docs ?? 0),
      uploading: Number(totals?.uploading ?? 0),
      failed: Number(totals?.failed ?? 0),
    },
    byBucket: BUCKETS.map((b) => {
      const r = byBucket.find((x) => x.category === b.id);
      return { id: b.id, label: b.label, files: Number(r?.files ?? 0), bytes: Number(r?.bytes ?? 0) };
    }),
    heaviest: heavy,
    alerts,
    traffic: null,
    trafficNote:
      'El tráfico de transferencia no lo expone el almacenamiento por API; consúltalo en el panel de consumo de Neon (Console → proyecto l3troy-dj).',
  });
}
