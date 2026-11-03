'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export async function jf<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`) as Error & { data?: any; status?: number };
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export function fmtBytes(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 100 ? 0 : 1)} ${u[i]}`;
}

export function fmtDur(s: number | string | null | undefined) {
  const v = Number(s ?? 0);
  if (!v) return '';
  const m = Math.floor(v / 60);
  return `${m}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
}

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type ToastFn = (msg: string, bad?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad: boolean } | null>(null);
  const show = useCallback<ToastFn>((msg, bad = false) => {
    setT({ msg, bad });
    setTimeout(() => setT(null), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className={`toast ${t.bad ? 'bad' : ''}`} role="status">
          {t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel = 'Confirmar',
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div className="muted" style={{ fontSize: '0.92rem' }}>{body}</div>
        <div className="actions">
          <button className={`btn ${danger ? 'magenta' : 'solid'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
