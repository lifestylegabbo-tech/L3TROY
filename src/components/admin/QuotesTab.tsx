'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Confirm, jf, useToast } from './helpers';

export const STATUSES = [
  ['nueva', 'Nueva'],
  ['en_revision', 'En revisión'],
  ['enviada', 'Enviada'],
  ['aceptada', 'Aceptada'],
  ['rechazada', 'Rechazada'],
  ['vencida', 'Vencida'],
] as const;
const label = (s: string) => STATUSES.find((x) => x[0] === s)?.[1] ?? s;

type Item = { description: string; qty: number; price: number };
type Quote = {
  id: string; number: string; status: string; client_id: string | null; client_name: string | null; client_email: string | null; client_phone: string | null;
  service_id: string | null; service_name: string | null; event_date: string | null; venue: string | null; city: string | null; guests: number | null;
  message: string | null; items: Item[]; total: string; currency: string; valid_until: string | null; internal_notes: string | null; source: string; created_at: string;
};
type Client = { id: string; name: string; email: string | null; phone: string | null };
type Service = { id: string; name: string; description: string | null; base_price: string | null; active: boolean };

export const money = (n: number | string, cur = 'GTQ') => `${cur === 'USD' ? '$' : 'Q'}${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? d.slice(0, 10) : '');
const dayLabel = (d: string | null) => (d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function QuotesTab({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Quote | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (search) qs.set('q', search);
      const r = await jf<{ quotes: Quote[]; counts: Record<string, number> }>(`/api/admin/quotes?${qs}`);
      setQuotes(r.quotes);
      setCounts(r.counts);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [status, search, toast]);
  const loadRefs = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([jf<{ clients: Client[] }>('/api/admin/clients'), jf<{ services: Service[] }>('/api/admin/services')]);
      setClients(c.clients);
      setServices(s.services);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return (
    <>
      <section className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Cotizaciones</h2>
            <p className="sub" style={{ margin: '4px 0 0' }}>Llegan solas desde el formulario «Cotiza tu evento» de la página, o créalas tú aquí.</p>
          </div>
          <button className="btn solid" onClick={() => setEdit('new')}>+ Nueva cotización</button>
        </div>
        <div className="chips">
          <button className={`chip ${status === '' ? 'on' : ''}`} onClick={() => setStatus('')}>Todas · {total}</button>
          {STATUSES.map(([id, l]) => (
            <button key={id} className={`chip ${status === id ? 'on' : ''}`} onClick={() => setStatus(id)}>
              {l} · {counts[id] ?? 0}
            </button>
          ))}
        </div>
        <label className="f" style={{ marginTop: 12 }}>
          Buscar
          <input type="search" placeholder="Número, cliente, correo o lugar" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </section>

      <section className="panel">
        {quotes.length === 0 ? (
          <p className="muted">No hay cotizaciones con este filtro.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead>
                <tr><th>N.º</th><th>Cliente</th><th>Servicio</th><th>Evento</th><th>Total</th><th>Estado</th><th>Origen</th><th /></tr>
              </thead>
              <tbody>
                {quotes.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.number}</b></td>
                    <td>{x.client_name ?? '—'}<div className="muted" style={{ fontSize: '0.78rem' }}>{x.client_email || x.client_phone || ''}</div></td>
                    <td>{x.service_name ?? '—'}</td>
                    <td>{dayLabel(x.event_date)}<div className="muted" style={{ fontSize: '0.78rem' }}>{[x.venue, x.city].filter(Boolean).join(', ')}</div></td>
                    <td>{Number(x.total) ? money(x.total, x.currency) : '—'}</td>
                    <td><span className={`badge st-${x.status}`}>{label(x.status)}</span></td>
                    <td>{x.source === 'landing' ? 'Página' : 'Panel'}</td>
                    <td><button className="btn sm" onClick={() => setEdit(x)}>Abrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ServicesPanel services={services} isAdmin={isAdmin} reload={loadRefs} />

      {edit && (
        <QuoteModal
          quote={edit === 'new' ? null : edit}
          clients={clients}
          services={services}
          isAdmin={isAdmin}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
            loadRefs();
          }}
        />
      )}
    </>
  );
}

function QuoteModal({ quote, clients, services, isAdmin, onClose, onSaved }: { quote: Quote | null; clients: Client[]; services: Service[]; isAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = !quote;
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(clients.length ? 'existing' : 'new');
  const [clientId, setClientId] = useState(quote?.client_id ?? '');
  const [nc, setNc] = useState({ name: '', email: '', phone: '', company: '' });
  const [f, setF] = useState({
    status: quote?.status ?? 'en_revision',
    service_id: quote?.service_id ?? '',
    service_name: quote?.service_name ?? '',
    event_date: day(quote?.event_date ?? null),
    venue: quote?.venue ?? '',
    city: quote?.city ?? '',
    guests: quote?.guests ? String(quote.guests) : '',
    message: quote?.message ?? '',
    currency: quote?.currency ?? 'GTQ',
    valid_until: day(quote?.valid_until ?? null),
    internal_notes: quote?.internal_notes ?? '',
  });
  const [items, setItems] = useState<Item[]>(quote?.items?.length ? quote.items : []);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);

  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const setItem = (idx: number, patch: Partial<Item>) => setItems((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const addService = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (s) setItems((a) => [...a, { description: s.name, qty: 1, price: Number(s.base_price ?? 0) }]);
  };

  async function save() {
    setBusy(true);
    try {
      const common = {
        event_date: f.event_date, venue: f.venue, city: f.city, guests: f.guests ? Number(f.guests) : 0, message: f.message,
        items, currency: f.currency, valid_until: f.valid_until, internal_notes: f.internal_notes,
      };
      if (isNew) {
        const body: any = { ...common, service_id: f.service_id || undefined };
        if (clientMode === 'existing') body.client_id = clientId;
        else body.new_client = nc;
        await jf('/api/admin/quotes', { method: 'POST', body: JSON.stringify(body) });
        toast('Cotización creada.');
      } else {
        await jf(`/api/admin/quotes/${quote!.id}`, { method: 'PATCH', body: JSON.stringify({ ...common, status: f.status, service_name: f.service_name }) });
        toast('Cotización guardada.');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const phoneDigits = quote?.client_phone?.replace(/\D/g, '');
  const canSave = isNew ? (clientMode === 'existing' ? !!clientId : nc.name.trim().length >= 2) : true;

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <h3 style={{ marginTop: 0 }}>{isNew ? 'Nueva cotización' : `Cotización ${quote!.number}`}</h3>
          <button className="btn sm" onClick={onClose}>Cerrar</button>
        </div>

        {isNew ? (
          <div className="qm-block">
            <div className="chips" style={{ marginTop: 0 }}>
              <button className={`chip ${clientMode === 'existing' ? 'on' : ''}`} onClick={() => setClientMode('existing')} disabled={!clients.length}>Cliente existente</button>
              <button className={`chip ${clientMode === 'new' ? 'on' : ''}`} onClick={() => setClientMode('new')}>Cliente nuevo</button>
            </div>
            {clientMode === 'existing' ? (
              <label className="f">Cliente
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
                </select>
              </label>
            ) : (
              <div className="row two">
                <label className="f">Nombre *<input type="text" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></label>
                <label className="f">Correo<input type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></label>
                <label className="f">Teléfono<input type="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></label>
                <label className="f">Empresa<input type="text" value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} /></label>
              </div>
            )}
          </div>
        ) : (
          <div className="qm-block" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>{quote!.client_name ?? 'Sin cliente'}</b>
              <div className="muted" style={{ fontSize: '0.85rem' }}>{[quote!.client_email, quote!.client_phone].filter(Boolean).join(' · ')}</div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>Recibida {new Date(quote!.created_at).toLocaleString('es-GT')} · {quote!.source === 'landing' ? 'desde la página' : 'creada en el panel'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {quote!.client_email && <a className="btn sm" href={`mailto:${quote!.client_email}?subject=${encodeURIComponent('Cotización ' + quote!.number)}`}>Correo</a>}
              {phoneDigits && <a className="btn sm" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            </div>
          </div>
        )}

        <div className="row two" style={{ marginTop: 14 }}>
          {!isNew && (
            <label className="f">Estado
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                {STATUSES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </label>
          )}
          {isNew ? (
            <label className="f">Servicio
              <select value={f.service_id} onChange={(e) => setF({ ...f, service_id: e.target.value })}>
                <option value="">Selecciona…</option>
                {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="f">Servicio<input type="text" value={f.service_name} onChange={(e) => setF({ ...f, service_name: e.target.value })} /></label>
          )}
          <label className="f">Fecha del evento<input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></label>
          <label className="f">Invitados<input type="number" min={0} value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} /></label>
          <label className="f">Lugar / venue<input type="text" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></label>
          <label className="f">Ciudad<input type="text" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        </div>
        <label className="f" style={{ marginTop: 12 }}>Mensaje del cliente<textarea rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>

        <h4 style={{ margin: '20px 0 8px' }}>Partidas de la cotización</h4>
        {items.length === 0 && <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Aún no hay partidas. Agrega una para calcular el total.</p>}
        <div className="qm-items">
          {items.map((it, i) => (
            <div className="qm-item" key={i}>
              <input type="text" placeholder="Descripción" aria-label="Descripción" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              <input type="number" min={0} step="1" aria-label="Cantidad" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
              <input type="number" min={0} step="0.01" aria-label="Precio unitario" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} />
              <span className="qm-sub">{money(it.qty * it.price, f.currency)}</span>
              <button className="btn sm magenta" aria-label="Quitar partida" onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <button className="btn sm" onClick={() => setItems((a) => [...a, { description: '', qty: 1, price: 0 }])}>+ Partida</button>
          {services.filter((s) => s.active).length > 0 && (
            <select aria-label="Agregar servicio del catálogo" style={{ width: 'auto' }} value="" onChange={(e) => addService(e.target.value)}>
              <option value="">+ Desde el catálogo…</option>
              {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        <div className="row three" style={{ marginTop: 14 }}>
          <label className="f">Moneda
            <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              <option value="GTQ">Quetzales (Q)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </label>
          <label className="f">Válida hasta<input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></label>
          <div className="qm-total"><span>Total</span><b>{money(total, f.currency)}</b></div>
        </div>
        <label className="f" style={{ marginTop: 12 }}>Notas internas (el cliente no las ve)<textarea rows={2} value={f.internal_notes} onChange={(e) => setF({ ...f, internal_notes: e.target.value })} /></label>

        <div className="actions">
          <button className="btn solid" disabled={busy || !canSave} onClick={save}>{busy ? 'Guardando…' : isNew ? 'Crear cotización' : 'Guardar cambios'}</button>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {!isNew && isAdmin && <button className="btn magenta" onClick={() => setDel(true)}>Eliminar</button>}
        </div>
      </div>
      {del && quote && (
        <Confirm title="¿Eliminar cotización?" danger confirmLabel="Eliminar" body={`Se borrará ${quote.number} de forma definitiva. El cliente se conserva.`} onCancel={() => setDel(false)} onConfirm={async () => {
          try { await jf(`/api/admin/quotes/${quote.id}`, { method: 'DELETE' }); toast('Cotización eliminada.'); onSaved(); } catch (e) { toast((e as Error).message, true); setDel(false); }
        }} />
      )}
    </div>
  );
}

function ServicesPanel({ services, isAdmin, reload }: { services: Service[]; isAdmin: boolean; reload: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', description: '', base_price: '' });
  const [del, setDel] = useState<Service | null>(null);

  const add = async () => {
    try {
      await jf('/api/admin/services', { method: 'POST', body: JSON.stringify(f) });
      setF({ name: '', description: '', base_price: '' });
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const patch = async (s: Service, body: object) => {
    try {
      await jf(`/api/admin/services/${s.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  return (
    <section className="panel">
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? '▾' : '▸'} Servicios del cotizador ({services.length})</button>
      {open && (
        <>
          <p className="sub">Estos son los tipos de evento que el cliente elige en la página. El precio base es opcional y solo se usa como sugerencia al armar una cotización.</p>
          <div className="row three">
            <label className="f">Nombre<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="f">Descripción<input type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <label className="f">Precio base (opcional)<input type="number" min={0} step="0.01" value={f.base_price} onChange={(e) => setF({ ...f, base_price: e.target.value })} /></label>
          </div>
          <div className="actions"><button className="btn solid" disabled={f.name.trim().length < 2} onClick={add}>Agregar servicio</button></div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="t">
              <thead><tr><th>Servicio</th><th>Precio base</th><th>En la página</th><th /></tr></thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}<div className="muted" style={{ fontSize: '0.78rem' }}>{s.description}</div></td>
                    <td>
                      <input type="number" min={0} step="0.01" defaultValue={s.base_price ?? ''} style={{ width: 110 }} aria-label={`Precio base de ${s.name}`}
                        onBlur={(e) => { if ((e.target.value || null) !== (s.base_price ?? null) && Number(e.target.value) !== Number(s.base_price ?? NaN)) patch(s, { base_price: e.target.value === '' ? null : Number(e.target.value) }); }} />
                    </td>
                    <td><button className="btn sm" onClick={() => patch(s, { active: !s.active })}>{s.active ? 'Visible' : 'Oculto'}</button></td>
                    <td>{isAdmin && <button className="btn sm magenta" onClick={() => setDel(s)}>Eliminar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {del && (
        <Confirm title="¿Eliminar servicio?" danger confirmLabel="Eliminar" body={`«${del.name}» ya no aparecerá en el formulario. Las cotizaciones existentes conservan su nombre.`} onCancel={() => setDel(null)} onConfirm={async () => {
          try { await jf(`/api/admin/services/${del.id}`, { method: 'DELETE' }); } catch (e) { toast((e as Error).message, true); }
          setDel(null);
          reload();
        }} />
      )}
    </section>
  );
}
