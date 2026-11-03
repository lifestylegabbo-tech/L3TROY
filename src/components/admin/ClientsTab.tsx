'use client';

import { useCallback, useEffect, useState } from 'react';
import { Confirm, jf, useToast } from './helpers';

type Client = { id: string; name: string; email: string | null; phone: string | null; company: string | null; notes: string | null; source: string; created_at: string; quotes_count: number };
const empty = { name: '', email: '', phone: '', company: '', notes: '' };

export default function ClientsTab({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [f, setF] = useState(empty);
  const [edit, setEdit] = useState<Client | null>(null);
  const [del, setDel] = useState<Client | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await jf<{ clients: Client[] }>(`/api/admin/clients${search ? `?q=${encodeURIComponent(search)}` : ''}`);
      setClients(r.clients);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [search, toast]);
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const add = async () => {
    try {
      await jf('/api/admin/clients', { method: 'POST', body: JSON.stringify(f) });
      toast('Cliente agregado.');
      setF(empty);
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Agregar cliente</h2>
        <p className="sub">Quienes piden cotización desde la página se agregan solos aquí. También puedes registrar clientes a mano.</p>
        <div className="row three">
          <label className="f">Nombre *<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="f">Correo<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="f">Teléfono / WhatsApp<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className="f">Empresa<input type="text" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
          <label className="f" style={{ gridColumn: 'span 2' }}>Notas<input type="text" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <div className="actions"><button className="btn solid" disabled={f.name.trim().length < 2} onClick={add}>Agregar cliente</button></div>
      </section>

      <section className="panel">
        <h2>Clientes</h2>
        <label className="f">Buscar<input type="search" placeholder="Nombre, correo, teléfono o empresa" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        {clients.length === 0 ? (
          <p className="muted" style={{ marginTop: 14 }}>Todavía no hay clientes.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="t">
              <thead><tr><th>Nombre</th><th>Contacto</th><th>Empresa</th><th>Cotiz.</th><th>Origen</th><th /></tr></thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>{c.email ?? ''}<div className="muted" style={{ fontSize: '0.78rem' }}>{c.phone ?? ''}</div></td>
                    <td>{c.company ?? '—'}</td>
                    <td>{c.quotes_count}</td>
                    <td>{c.source === 'landing' ? 'Página' : 'Panel'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setEdit({ ...c })}>Editar</button>{' '}
                      {isAdmin && <button className="btn sm magenta" onClick={() => setDel(c)}>Eliminar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {edit && (
        <div className="modal-bg" role="dialog" aria-modal="true" onClick={() => setEdit(null)}>
          <div className="modal sm" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Editar cliente</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="f">Nombre<input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label className="f">Correo<input type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
              <label className="f">Teléfono<input type="tel" value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
              <label className="f">Empresa<input type="text" value={edit.company ?? ''} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></label>
              <label className="f">Notas<textarea rows={3} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            </div>
            <div className="actions">
              <button className="btn solid" disabled={edit.name.trim().length < 2} onClick={async () => {
                try {
                  await jf(`/api/admin/clients/${edit.id}`, { method: 'PATCH', body: JSON.stringify({ name: edit.name, email: edit.email ?? '', phone: edit.phone ?? '', company: edit.company ?? '', notes: edit.notes ?? '' }) });
                  toast('Cliente actualizado.');
                  setEdit(null);
                  load();
                } catch (e) { toast((e as Error).message, true); }
              }}>Guardar</button>
              <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {del && (
        <Confirm title="¿Eliminar cliente?" danger confirmLabel="Eliminar"
          body={del.quotes_count > 0 ? `${del.name} tiene ${del.quotes_count} cotización(es). Se conservarán, pero quedarán sin cliente asignado.` : `${del.name} se eliminará de forma definitiva.`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try { await jf(`/api/admin/clients/${del.id}?confirm=1`, { method: 'DELETE' }); toast('Cliente eliminado.'); } catch (e) { toast((e as Error).message, true); }
            setDel(null);
            load();
          }} />
      )}
    </>
  );
}
