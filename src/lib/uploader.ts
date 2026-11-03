'use client';

import { PART_SIZE } from './config';

export type JobState = 'queued' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

export type Job = {
  key: string;
  file: File;
  section: string | null;
  state: JobState;
  progress: number; // 0..100 del archivo original
  bytesDone: number;
  speed: number; // bytes/s
  error?: string;
  mediaId?: string;
  resumed?: boolean;
  previewUrl?: string;
  kind?: string;
};

type Listener = () => void;
const LS_PREFIX = 'l3.upload.';
const FILE_CONCURRENCY = 3;
const PART_CONCURRENCY = 3;

class Cancelled extends Error {}

function fingerprint(f: File) {
  return `${LS_PREFIX}${f.name}:${f.size}:${f.lastModified}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader('ETag'));
      else reject(new Error(`El almacenamiento respondió ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Se perdió la conexión durante la subida'));
    xhr.onabort = () => reject(new Cancelled());
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (signal.aborted) throw new Cancelled();
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Cancelled) throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw last;
}

/* ---------- metadatos y versiones de visualización (el original no se modifica) ---------- */

type Meta = { width?: number; height?: number; duration?: number };

async function imageMeta(file: File): Promise<{ meta: Meta; bitmap: ImageBitmap | null }> {
  try {
    const bmp = await createImageBitmap(file);
    return { meta: { width: bmp.width, height: bmp.height }, bitmap: bmp };
  } catch {
    return { meta: {}, bitmap: null };
  }
}

function mediaElementMeta(file: File, tag: 'video' | 'audio'): Promise<{ meta: Meta; el: HTMLVideoElement | null; url: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(tag);
    el.preload = 'metadata';
    el.muted = true;
    const done = (ok: boolean) =>
      resolve({
        meta: ok
          ? {
              duration: Number.isFinite(el.duration) ? el.duration : undefined,
              width: tag === 'video' ? (el as HTMLVideoElement).videoWidth || undefined : undefined,
              height: tag === 'video' ? (el as HTMLVideoElement).videoHeight || undefined : undefined,
            }
          : {},
        el: tag === 'video' ? (el as HTMLVideoElement) : null,
        url,
      });
    el.onloadedmetadata = () => done(true);
    el.onerror = () => done(false);
    setTimeout(() => done(false), 8000);
    el.src = url;
  });
}

async function toWebp(source: CanvasImageSource, sw: number, sh: number, maxW: number, quality: number) {
  const scale = Math.min(1, maxW / sw);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality));
  return blob ? { blob, w, h } : null;
}

async function uploadVariant(mediaId: string, label: 'sm' | 'lg' | 'poster', v: { blob: Blob; w: number; h: number }, signal: AbortSignal) {
  const init = await api<{ putUrl: string; path: string }>('/api/admin/uploads/init', {
    method: 'POST',
    body: JSON.stringify({ variantOf: mediaId, label }),
  });
  await withRetry(() => putWithProgress(init.putUrl, v.blob, 'image/webp', () => {}, signal), signal);
  await api('/api/admin/uploads/complete', {
    method: 'POST',
    body: JSON.stringify({ id: mediaId, variant: { label, path: init.path, width: v.w, height: v.h, size: v.blob.size } }),
  });
}

/* ---------- administrador de subidas ---------- */

export class UploadManager {
  jobs: Job[] = [];
  private listeners = new Set<Listener>();
  private controllers = new Map<string, AbortController>();
  private running = 0;
  private onDone?: (job: Job) => void;
  private snapshot: Job[] = [];

  constructor(onDone?: (job: Job) => void) {
    this.onDone = onDone;
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = [...this.jobs];
    this.listeners.forEach((l) => l());
  }
  private patch(key: string, p: Partial<Job>) {
    const j = this.jobs.find((x) => x.key === key);
    if (!j) return;
    Object.assign(j, p);
    this.jobs = this.jobs.map((x) => (x.key === key ? { ...j } : x));
    this.emit();
  }

  add(files: File[], section: string | null) {
    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = file.type.startsWith('image/') && !/tiff?$/i.test(file.type) ? URL.createObjectURL(file) : undefined;
      this.jobs.push({ key, file, section, state: 'queued', progress: 0, bytesDone: 0, speed: 0, previewUrl });
    }
    this.emit();
    this.pump();
  }

  private pump() {
    for (const j of this.jobs) {
      if (this.running >= FILE_CONCURRENCY) return;
      if (j.state === 'queued') {
        this.running++;
        this.run(j.key).finally(() => {
          this.running--;
          this.pump();
        });
      }
    }
  }

  cancel(key: string) {
    this.controllers.get(key)?.abort();
    const j = this.jobs.find((x) => x.key === key);
    if (j && (j.state === 'queued' || j.state === 'error')) {
      this.patch(key, { state: 'canceled' });
      if (j.mediaId) fetch('/api/admin/uploads/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.mediaId }) }).catch(() => {});
    }
  }

  retry(key: string) {
    this.patch(key, { state: 'queued', error: undefined, progress: 0, bytesDone: 0 });
    this.pump();
  }

  remove(key: string) {
    const j = this.jobs.find((x) => x.key === key);
    if (j?.previewUrl) URL.revokeObjectURL(j.previewUrl);
    this.jobs = this.jobs.filter((x) => x.key !== key);
    this.emit();
  }

  clearFinished() {
    for (const j of this.jobs) if (j.state === 'done' || j.state === 'canceled') this.remove(j.key);
  }

  private async run(key: string) {
    const job = this.jobs.find((x) => x.key === key)!;
    const ac = new AbortController();
    this.controllers.set(key, ac);
    const { signal } = ac;
    try {
      this.patch(key, { state: 'preparing', error: undefined });
      const file = job.file;
      const fp = fingerprint(file);

      // 1) ¿hay una carga previa de este mismo archivo que se pueda reanudar?
      let init: { id: string; kind: string; contentType?: string; mode: 'single' | 'multipart'; putUrl: string | null; totalParts: number; partSize: number } | null = null;
      let doneParts = new Map<number, string>();
      const saved = (() => {
        try {
          return JSON.parse(localStorage.getItem(fp) ?? 'null') as { id: string; kind: string; totalParts: number; partSize: number } | null;
        } catch {
          return null;
        }
      })();
      if (saved) {
        try {
          const r = await api<{ parts: { PartNumber: number; ETag: string }[] }>(`/api/admin/uploads/resume?id=${saved.id}`);
          init = { id: saved.id, kind: saved.kind, mode: 'multipart', putUrl: null, totalParts: saved.totalParts, partSize: saved.partSize };
          doneParts = new Map(r.parts.map((p) => [p.PartNumber, p.ETag]));
          this.patch(key, { resumed: true });
        } catch {
          localStorage.removeItem(fp);
        }
      }
      if (!init) {
        init = await api('/api/admin/uploads/init', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size, section: job.section }),
        });
        if (init!.mode === 'multipart') localStorage.setItem(fp, JSON.stringify({ id: init!.id, kind: init!.kind, totalParts: init!.totalParts, partSize: init!.partSize }));
      }
      const meta0 = init!;
      this.patch(key, { mediaId: meta0.id, kind: meta0.kind, state: 'uploading' });

      // 2) subir directo del navegador al almacenamiento
      const started = Date.now();
      let confirmed = 0;
      const inflight = new Map<number, number>();
      const report = () => {
        const sum = confirmed + [...inflight.values()].reduce((a, b) => a + b, 0);
        const secs = Math.max(0.5, (Date.now() - started) / 1000);
        this.patch(key, { bytesDone: sum, progress: Math.min(99, (sum / file.size) * 100), speed: sum / secs });
      };

      let partsForComplete: { PartNumber: number; ETag: string }[] | undefined;
      if (meta0.mode === 'single') {
        await withRetry(
          () => putWithProgress(meta0.putUrl!, file, meta0.contentType || file.type || null, (l) => { inflight.set(1, l); report(); }, signal),
          signal,
        );
      } else {
        const size = meta0.partSize || PART_SIZE;
        for (const [n] of doneParts) confirmed += Math.min(size, file.size - (n - 1) * size);
        report();
        const pending: number[] = [];
        for (let n = 1; n <= meta0.totalParts; n++) if (!doneParts.has(n)) pending.push(n);
        let cursor = 0;
        const worker = async () => {
          while (cursor < pending.length) {
            if (signal.aborted) throw new Cancelled();
            const n = pending[cursor++];
            const start = (n - 1) * size;
            const blob = file.slice(start, Math.min(file.size, start + size));
            const etag = await withRetry(async () => {
              const { url } = await api<{ url: string }>('/api/admin/uploads/part', {
                method: 'POST',
                body: JSON.stringify({ id: meta0.id, partNumber: n }),
              });
              inflight.set(n, 0);
              const tag = await putWithProgress(url, blob, null, (l) => { inflight.set(n, l); report(); }, signal);
              if (!tag) throw new Error('El almacenamiento no devolvió la huella de la parte (revisa CORS: ETag expuesto)');
              return tag;
            }, signal);
            inflight.delete(n);
            confirmed += blob.size;
            doneParts.set(n, etag);
            report();
          }
        };
        await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, pending.length || 1) }, worker));
        partsForComplete = [...doneParts.entries()].map(([PartNumber, ETag]) => ({ PartNumber, ETag }));
      }

      // 3) metadatos del original (sin modificarlo)
      this.patch(key, { state: 'processing', progress: 99 });
      let meta: Meta = {};
      let bitmap: ImageBitmap | null = null;
      let videoEl: HTMLVideoElement | null = null;
      let objUrl: string | null = null;
      if (meta0.kind === 'image') ({ meta, bitmap } = await imageMeta(file));
      else if (meta0.kind === 'video' || meta0.kind === 'audio') {
        const r = await mediaElementMeta(file, meta0.kind);
        meta = r.meta;
        videoEl = r.el;
        objUrl = r.url;
      }

      await api('/api/admin/uploads/complete', {
        method: 'POST',
        body: JSON.stringify({ id: meta0.id, parts: partsForComplete, width: meta.width ?? null, height: meta.height ?? null, duration: meta.duration ?? null }),
      });
      localStorage.removeItem(fp);

      // 4) versiones de visualización (best effort: si falla, se sirve el original)
      try {
        if (bitmap) {
          const lg = await toWebp(bitmap, bitmap.width, bitmap.height, 1800, 0.84);
          const sm = await toWebp(bitmap, bitmap.width, bitmap.height, 640, 0.8);
          if (sm) await uploadVariant(meta0.id, 'sm', sm, signal);
          if (lg && bitmap.width > 700) await uploadVariant(meta0.id, 'lg', lg, signal);
        } else if (videoEl && meta.width && meta.height) {
          const v = videoEl;
          await new Promise<void>((res) => {
            v.onseeked = () => res();
            v.currentTime = Math.min(1, (meta.duration ?? 1) / 4);
            setTimeout(res, 4000);
          });
          const poster = await toWebp(v, meta.width, meta.height, 1280, 0.82);
          if (poster) await uploadVariant(meta0.id, 'poster', poster, signal);
        }
      } catch {
        /* sin versiones: la landing usa el original */
      } finally {
        bitmap?.close();
        if (objUrl) URL.revokeObjectURL(objUrl);
      }

      this.patch(key, { state: 'done', progress: 100, speed: 0 });
      this.onDone?.(this.jobs.find((x) => x.key === key)!);
    } catch (e) {
      if (e instanceof Cancelled) {
        const j = this.jobs.find((x) => x.key === key);
        if (j?.mediaId) {
          localStorage.removeItem(fingerprint(j.file));
          fetch('/api/admin/uploads/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.mediaId }) }).catch(() => {});
        }
        this.patch(key, { state: 'canceled' });
      } else {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        this.patch(key, { state: 'error', error: msg, speed: 0 });
      }
    } finally {
      this.controllers.delete(key);
    }
  }
}
