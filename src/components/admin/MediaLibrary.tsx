'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BUCKETS, SECTIONS } from '@/lib/config';
import { UploadManager, type Job } from '@/lib/uploader';
import { Confirm, fmtBytes, fmtDur, jf, toLocalInput, useToast } from './helpers';

type Item = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  section: string | null;
  category: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  mime_type: string;
  size_bytes: string | number;
  width: number | null;
  height: number | null;
  duration_seconds: string | number | null;
  status: 'draft' | 'published' | 'archived';
  upload_state: 'uploading' | 'ready' | 'failed';
  upload_error: string | null;
  publish_at: string | null;
  sort_order: number;
  created_at: string;
  uploaded_by_name?: string | null;
};

const ACCEPT = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.mp4,.mov,.webm,.mp3,.wav,.flac,.pdf,image/*,video/*,audio/*,application/pdf';
const STATE_LABEL: Record<string, string> = {
  queued: 'En espera',
  preparing: 'Preparando…',
  uploading: 'Subiendo',
  processing: 'Generando vistas…',
  done: 'Listo',
  error: 'Error',
  canceled: 'Cancelado',
};
const KIND_LABEL = { image: 'Foto', video: 'Video', audio: 'Audio', document: 'PDF' } as const;

function Thumb({ item }: { item: Item }) {
  const [bad, setBad] = useState(false);
  if (item.upload_state !== 'ready') return <span>{item.upload_state === 'failed' ? 'Falló' : 'Subiendo…'}</span>;
  if ((item.kind === 'image' || item.kind === 'video') && !bad) {
    const v = item.kind === 'video' ? 'poster' : 'sm';
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/media/${item.id}?v=${v}`} alt="" loading="lazy" onError={() => setBad(true)} />;
  }
  return <span>{KIND_LABEL[item.kind]}{item.mime_type.includes('tiff') ? ' TIFF' : ''}</span>;
}

export default function MediaLibrary() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [filters, setFilters] = useState({ q: '', section: '', status: '', category: '', kind: '' });
  const [edit, setEdit] = useState<Item | null>(null);
  const [dz, setDz] = useState(false);
  const [targetSection, setTargetSection] = useState('galeria');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (append = false, offset = 0) => {
      setLoading(true);
      const p = new URLSearchParams({ limit: '60', offset: String(offset) });
      for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
      try {
        const r = await jf<{ items: Item[] }>(`/api/admin/media?${p}`);
        setItems((prev) => (append ? [...prev, ...r.items] : r.items));
        setMore(r.items.length === 60);
      } catch (e) {
        toast((e as Error).message, true);
      } finally {
        setLoading(false);
      }
    },
    [filters, toast],
  );

  useEffect(() => {
    const t = setTimeout(() => load(), filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  // administrador de subidas (vive mientras el panel esté abierto)
  const mgr = useMemo(() => new UploadManager(() => {}), []);
  const jobs = useSyncExternalStore(mgr.subscribe, mgr.getSnapshot, mgr.getSnapshot);
  const doneRef = useRef(0);
  useEffect(() => {
    const done = jobs.filter((j) => j.state === 'done').length;
    if (done !== doneRef.current) {
      doneRef.current = done;
      load();
    }
  }, [jobs, load]);

  const active = jobs.some((j) => ['queued', 'preparing', 'uploading', 'processing'].includes(j.state));
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);

  const addFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    mgr.add(files, targetSection || null);
  };

  /* publicación en lote de lo que se acaba de subir */
  const [bulk, setBulk] = useState({ section: '', title: '', description: '', publish_at: '' });
  const doneJobs = jobs.filter((j) => j.state === 'done' && j.mediaId);
  const applyBulk = async (status: 'published' | 'draft') => {
    const section = bulk.section || targetSection;
    if (status === 'published' && !section) return toast('Elige en qué sección aparecerán.', true);
    let ok = 0;
    for (const j of doneJobs) {
      try {
        await jf(`/api/admin/media/${j.mediaId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            section: section || null,
            status,
            ...(bulk.title && doneJobs.length === 1 ? { title: bulk.title } : {}),
            ...(bulk.description ? { description: bulk.description } : {}),
            ...(bulk.publish_at ? { publish_at: new Date(bulk.publish_at).toISOString() } : {}),
          }),
        });
        ok++;
      } catch (e) {
        toast(`${j.file.name}: ${(e as Error).message}`, true);
      }
    }
    if (ok) {
      toast(status === 'published' ? `${ok} archivo(s) publicados en la landing.` : `${ok} archivo(s) guardados como borrador.`);
      mgr.clearFinished();
      setBulk({ section: '', title: '', description: '', publish_at: '' });
      load();
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Subir archivos</h2>
        <p className="sub">Arrastra tus fotos, videos, audios o PDF aquí, o elige archivos desde tu computadora. Los originales se guardan sin cambios.</p>
        <div
          className={`dropzone ${dz ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDz(true);
          }}
          onDragLeave={() => setDz(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDz(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <h3 style={{ margin: '0 0 6px' }}>Suelta los archivos para subirlos</h3>
          <p className="muted" style={{ margin: '0 0 16px' }}>
            JPG · PNG · WebP · TIFF · MP4 · MOV · WebM · MP3 · WAV · FLAC · PDF — puedes subir varios a la vez
          </p>
          <button className="btn solid" onClick={() => inputRef.current?.click()}>
            Seleccionar archivos
          </button>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="dz-opts">
            <label htmlFor="tsec">¿Dónde aparecerán?</label>
            <select id="tsec" value={targetSection} onChange={(e) => setTargetSection(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Decidir después</option>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {jobs.length > 0 && (
          <>
            <div className="queue">
              {jobs.map((j) => (
                <QueueItem key={j.key} job={j} mgr={mgr} />
              ))}
            </div>

            {doneJobs.length > 0 && (
              <div className="panel" style={{ marginTop: 18, marginBottom: 0, background: 'var(--bg-3)' }}>
                <h3>Publicar {doneJobs.length} archivo(s) recién subidos</h3>
                <p className="sub">Elige dónde aparecerán, agrega una descripción y presiona Publicar. Todo se puede cambiar después.</p>
                <div className="row two">
                  <label className="f">
                    Sección de la landing
                    <select value={bulk.section || targetSection} onChange={(e) => setBulk({ ...bulk, section: e.target.value })}>
                      <option value="">Elegir…</option>
                      {SECTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="f">
                    Publicar el (opcional, si lo dejas vacío es ahora)
                    <input type="datetime-local" value={bulk.publish_at} onChange={(e) => setBulk({ ...bulk, publish_at: e.target.value })} />
                  </label>
                </div>
                <div className="row two" style={{ marginTop: 12 }}>
                  <label className="f">
                    Título {doneJobs.length > 1 && '(solo con un archivo)'}
                    <input type="text" disabled={doneJobs.length > 1} value={bulk.title} onChange={(e) => setBulk({ ...bulk, title: e.target.value })} />
                  </label>
                  <label className="f">
                    Descripción
                    <input type="text" value={bulk.description} onChange={(e) => setBulk({ ...bulk, description: e.target.value })} />
                  </label>
                </div>
                <div className="actions">
                  <button className="btn solid" onClick={() => applyBulk('published')}>
                    Publicar
                  </button>
                  <button className="btn" onClick={() => applyBulk('draft')}>
                    Guardar como borrador
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Biblioteca de medios</h2>
        <div className="filters">
          <input type="text" placeholder="Buscar por nombre…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })}>
            <option value="">Todas las secciones</option>
            <option value="none">Sin sección</option>
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
          <select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
            <option value="">Todos los tipos</option>
            <option value="image">Fotos</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="document">PDF</option>
          </select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">Todas las carpetas</option>
            {BUCKETS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
        {loading && !items.length ? (
          <p className="muted">Cargando…</p>
        ) : !items.length ? (
          <p className="muted">Todavía no hay archivos con estos filtros.</p>
        ) : (
          <div className="mgrid">
            {items.map((it) => (
              <button key={it.id} className="mcard" onClick={() => setEdit(it)}>
                <div className="mth">
                  <Thumb item={it} />
                </div>
                <div className="mb">
                  <b>{it.title || it.name}</b>
                  <small>
                    {KIND_LABEL[it.kind]} · {fmtBytes(it.size_bytes)} {it.duration_seconds ? `· ${fmtDur(it.duration_seconds)}` : ''}
                  </small>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge ${it.upload_state !== 'ready' ? it.upload_state : it.status}`}>
                      {it.upload_state === 'uploading' ? 'Subiendo' : it.upload_state === 'failed' ? 'Falló' : it.status === 'published' ? 'Publicado' : it.status === 'draft' ? 'Borrador' : 'Archivado'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {more && (
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => load(true, items.length)}>
              Cargar más
            </button>
          </div>
        )}
      </section>

      {edit && (
        <EditModal
          item={edit}
          onClose={() => setEdit(null)}
          onSaved={(it) => {
            setItems((l) => l.map((x) => (x.id === it.id ? { ...x, ...it } : x)));
            setEdit(null);
          }}
          onDeleted={(id) => {
            setItems((l) => l.filter((x) => x.id !== id));
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function QueueItem({ job, mgr }: { job: Job; mgr: UploadManager }) {
  const busy = ['queued', 'preparing', 'uploading', 'processing'].includes(job.state);
  return (
    <div className={`qitem ${job.state === 'error' ? 'err' : job.state === 'done' ? 'ok' : ''}`}>
      <div className="thumb">
        {job.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.previewUrl} alt="" />
        ) : (
          <span>{job.file.type.startsWith('video/') ? 'VIDEO' : job.file.type.startsWith('audio/') ? 'AUDIO' : job.file.name.split('.').pop()?.toUpperCase()}</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="qname">{job.file.name}</div>
        <div className="qmeta">
          {fmtBytes(job.file.size)} · {STATE_LABEL[job.state]}
          {job.state === 'uploading' && ` · ${Math.round(job.progress)}% · ${fmtBytes(job.speed)}/s`}
          {job.resumed && ' · reanudada'}
        </div>
        <div className="bar" aria-label="Progreso">
          <i style={{ ['--w' as string]: `${job.state === 'done' ? 100 : job.progress}%` }} />
        </div>
        {job.error && <div className="qerr">{job.error}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {busy && (
          <button className="btn sm" onClick={() => mgr.cancel(job.key)}>
            Cancelar
          </button>
        )}
        {job.state === 'error' && (
          <>
            <button className="btn sm solid" onClick={() => mgr.retry(job.key)}>
              Reintentar
            </button>
            <button className="btn sm" onClick={() => { mgr.cancel(job.key); mgr.remove(job.key); }}>
              Descartar
            </button>
          </>
        )}
        {(job.state === 'canceled' || job.state === 'done') && (
          <button className="btn sm" onClick={() => mgr.remove(job.key)}>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function EditModal({ item, onClose, onSaved, onDeleted }: { item: Item; onClose: () => void; onSaved: (i: Item) => void; onDeleted: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: item.name,
    title: item.title ?? '',
    description: item.description ?? '',
    alt_text: item.alt_text ?? '',
    section: item.section ?? '',
    category: item.category,
    status: item.status,
    publish_at: toLocalInput(item.publish_at),
    sort_order: item.sort_order,
  });
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<null | { usage: string[] }>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async (status?: Item['status']) => {
    setSaving(true);
    try {
      const r = await jf<{ item: Item }>(`/api/admin/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: f.name || item.name,
          title: f.title || null,
          description: f.description || null,
          alt_text: f.alt_text || null,
          section: f.section || null,
          category: f.category,
          status: status ?? f.status,
          publish_at: f.publish_at ? new Date(f.publish_at).toISOString() : null,
          sort_order: Number(f.sort_order) || 0,
        }),
      });
      toast(status === 'published' ? 'Publicado en la landing.' : 'Cambios guardados.');
      onSaved(r.item);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  const tryDelete = async (confirm: boolean) => {
    try {
      await jf(`/api/admin/media/${item.id}${confirm ? '?confirm=1' : ''}`, { method: 'DELETE' });
      toast('Archivo eliminado.');
      onDeleted(item.id);
    } catch (e) {
      const err = e as Error & { data?: { inUse?: boolean; usage?: string[] } };
      if (err.data?.inUse) setDel({ usage: err.data.usage ?? [] });
      else toast(err.message, true);
    }
  };

  const ready = item.upload_state === 'ready';
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Editar archivo</h3>
          <button className="btn sm" onClick={onClose}>Cerrar</button>
        </div>
        <div className="modal-grid" style={{ marginTop: 16 }}>
          <div>
            <div className="preview">
              {!ready ? (
                <span className="muted">{item.upload_state === 'failed' ? `La subida falló. ${item.upload_error ?? ''}` : 'Subiendo…'}</span>
              ) : item.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${item.id}?v=lg`} alt={item.alt_text ?? ''} onError={(e) => { (e.currentTarget as HTMLImageElement).alt = 'Vista previa no disponible para este formato'; }} />
              ) : item.kind === 'video' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={`/api/media/${item.id}`} poster={`/api/media/${item.id}?v=poster`} controls preload="none" />
              ) : item.kind === 'audio' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio src={`/api/media/${item.id}`} controls preload="none" style={{ width: '90%' }} />
              ) : (
                <a className="btn" href={`/api/media/${item.id}`} target="_blank" rel="noreferrer">Abrir PDF</a>
              )}
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
              {item.mime_type} · {fmtBytes(item.size_bytes)}
              {item.width ? ` · ${item.width}×${item.height}px` : ''}
              {item.duration_seconds ? ` · ${fmtDur(item.duration_seconds)}` : ''}
              <br />
              Subido {new Date(item.created_at).toLocaleString('es-GT')} {item.uploaded_by_name ? `por ${item.uploaded_by_name}` : ''}
            </p>
            {ready && (
              <a className="btn sm" href={`/api/media/${item.id}?download=1`}>
                Descargar original
              </a>
            )}
          </div>
          <div className="row">
            <label className="f">
              Nombre del archivo
              <input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label className="f">
              Título (se muestra en la landing)
              <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </label>
            <label className="f">
              Descripción
              <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <label className="f">
              Texto alternativo (accesibilidad)
              <input type="text" value={f.alt_text} onChange={(e) => setF({ ...f, alt_text: e.target.value })} />
            </label>
            <div className="row two">
              <label className="f">
                Sección de la landing
                <select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
                  <option value="">Sin sección</option>
                  {SECTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="f">
                Carpeta / categoría
                <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} disabled={!ready}>
                  {BUCKETS.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row two">
              <label className="f">
                Estado
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Item['status'] })}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Archivado</option>
                </select>
              </label>
              <label className="f">
                Fecha de publicación
                <input type="datetime-local" value={f.publish_at} onChange={(e) => setF({ ...f, publish_at: e.target.value })} />
              </label>
            </div>
            <label className="f">
              Orden dentro de la sección (menor = primero)
              <input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} />
            </label>
          </div>
        </div>
        <div className="actions">
          <button className="btn solid" disabled={saving || !ready} onClick={() => save('published')}>Publicar</button>
          <button className="btn" disabled={saving} onClick={() => save()}>Guardar cambios</button>
          <button className="btn" disabled={saving || !ready} onClick={() => save('archived')}>Archivar</button>
          <button className="btn magenta" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(true)}>Eliminar</button>
        </div>
      </div>

      {confirmDel && !del && (
        <Confirm
          title="¿Eliminar este archivo?"
          danger
          confirmLabel="Eliminar"
          body="Se borrará el original y sus versiones de visualización. Esta acción no se puede deshacer."
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => { setConfirmDel(false); tryDelete(false); }}
        />
      )}
      {del && (
        <Confirm
          title="Este archivo está en uso"
          danger
          confirmLabel="Eliminar de todos modos"
          body={
            <>
              <ul style={{ paddingLeft: 18 }}>
                {del.usage.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
              Si lo eliminas, desaparecerá de la landing y de esos lugares (no quedarán enlaces rotos).
            </>
          }
          onCancel={() => setDel(null)}
          onConfirm={() => { setDel(null); tryDelete(true); }}
        />
      )}
    </div>
  );
}
