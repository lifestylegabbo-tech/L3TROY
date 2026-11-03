'use client';

import { useEffect, useState } from 'react';
import { fmtBytes, jf, useToast } from './helpers';

type S = {
  usedBytes: number; originalBytes: number; variantBytes: number; quotaBytes: number | null; quotaConfigured: boolean;
  counts: { files: number; images: number; videos: number; audio: number; documents: number; uploading: number; failed: number };
  byBucket: { id: string; label: string; files: number; bytes: number }[];
  heaviest: { id: string; name: string; kind: string; category: string; size_bytes: string; status: string }[];
  alerts: { level: 'warn' | 'danger'; message: string }[];
  trafficNote: string;
};

export default function StorageTab({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const [s, setS] = useState<S | null>(null);
  useEffect(() => {
    jf<S>('/api/admin/storage').then(setS).catch((e) => toast(e.message, true));
  }, [toast]);
  if (!s) return <p className="muted">Cargando…</p>;
  const pct = s.quotaBytes ? Math.min(100, (s.usedBytes / s.quotaBytes) * 100) : null;
  return (
    <>
      {s.alerts.map((a) => (
        <div key={a.message} className={`alert ${a.level}`}>{a.message}</div>
      ))}
      <div className="kpis">
        <div className="kpi"><b>{fmtBytes(s.usedBytes)}</b><span>Espacio usado</span></div>
        <div className="kpi"><b>{s.quotaBytes ? fmtBytes(Math.max(0, s.quotaBytes - s.usedBytes)) : '—'}</b><span>Disponible</span></div>
        <div className="kpi"><b>{s.counts.images}</b><span>Fotografías</span></div>
        <div className="kpi"><b>{s.counts.videos}</b><span>Videos</span></div>
        <div className="kpi"><b>{s.counts.audio}</b><span>Audios</span></div>
        <div className="kpi"><b>{s.counts.files}</b><span>Archivos</span></div>
      </div>
      <section className="panel">
        <h2>Capacidad</h2>
        {pct === null ? (
          <p className="sub">
            No se ha configurado la cuota real del plan. Agrega la variable <code>STORAGE_QUOTA_BYTES</code> con el límite de tu plan de Neon para ver el porcentaje y las alertas. No se inventan cuotas.
          </p>
        ) : (
          <>
            <div className="bar" style={{ height: 14 }}><i style={{ ['--w' as string]: `${pct}%` }} /></div>
            <p className="sub" style={{ marginTop: 8 }}>{pct.toFixed(1)}% de {fmtBytes(s.quotaBytes)} utilizado</p>
          </>
        )}
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Originales: {fmtBytes(s.originalBytes)} · Versiones de visualización: {fmtBytes(s.variantBytes)}
        </p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>{s.trafficNote}</p>
      </section>
      {isAdmin && (
        <section className="panel">
          <h2>Permisos de subida del navegador</h2>
          <p className="sub">Si al subir un archivo aparece un error de conexión o de «CORS», presiona este botón una vez para autorizar este dominio en las 8 carpetas.</p>
          <button
            className="btn"
            onClick={async () => {
              try {
                const r = await jf<{ origins: string[] }>('/api/admin/setup-cors', { method: 'POST' });
                toast(`Listo. Dominios autorizados: ${r.origins.join(', ')}`);
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            Configurar permisos de subida
          </button>
        </section>
      )}
      <section className="panel">
        <h2>Por carpeta</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>Carpeta</th><th>Archivos</th><th>Tamaño</th></tr></thead>
            <tbody>{s.byBucket.map((b) => <tr key={b.id}><td>{b.label} <span className="muted">({b.id})</span></td><td>{b.files}</td><td>{fmtBytes(b.bytes)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Archivos más pesados</h2>
        {s.heaviest.length === 0 ? <p className="muted">Aún no hay archivos.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>Archivo</th><th>Tipo</th><th>Carpeta</th><th>Tamaño</th></tr></thead>
              <tbody>{s.heaviest.map((h) => <tr key={h.id}><td>{h.name}</td><td>{h.kind}</td><td>{h.category}</td><td>{fmtBytes(h.size_bytes)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
