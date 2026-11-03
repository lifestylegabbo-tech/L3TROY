'use client';

import { useEffect, useState } from 'react';
import { Confirm, jf, useToast } from './helpers';

type Content = Record<string, string>;
type EventRow = { id: string; title: string; venue: string | null; city: string | null; event_date: string; ticket_url: string | null; description: string | null; published: boolean };

const GROUPS: { title: string; fields: [string, string, boolean?][] }[] = [
  { title: 'Portada', fields: [['artist', 'Nombre artístico'], ['role', 'Descriptor'], ['tagline', 'Frase principal'], ['hero_cta', 'Texto del botón principal']] },
  { title: 'Capítulo 01 · Historia', fields: [['historia_title', 'Título'], ['historia_body', 'Texto', true]] },
  { title: 'Capítulo 02 · Estudio', fields: [['estudio_title', 'Título'], ['estudio_body', 'Texto', true]] },
  { title: 'Capítulo 03 · Sets', fields: [['sets_title', 'Título'], ['sets_body', 'Texto', true]] },
  { title: 'Capítulo 04 · En cabina', fields: [['eventos_title', 'Título'], ['eventos_body', 'Texto', true]] },
  { title: 'Capítulo 05 · Galería', fields: [['galeria_title', 'Título'], ['galeria_body', 'Texto', true]] },
  { title: 'Capítulo 06 · Colaboraciones', fields: [['colaboraciones_title', 'Título'], ['colaboraciones_body', 'Texto', true]] },
  { title: 'Contacto y redes', fields: [['contacto_title', 'Título'], ['contacto_body', 'Texto', true], ['whatsapp', 'WhatsApp (con código de país, ej. 502XXXXXXXX)'], ['email', 'Correo de booking'], ['instagram', 'Instagram (URL)'], ['tiktok', 'TikTok (URL)'], ['youtube', 'YouTube (URL)'], ['spotify', 'Spotify (URL)'], ['soundcloud', 'SoundCloud (URL)']] },
];

export default function ContentTab() {
  const toast = useToast();
  const [c, setC] = useState<Content | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jf<{ content: Content }>('/api/admin/settings').then((r) => setC(r.content)).catch((e) => toast(e.message, true));
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      await jf('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ content: c }) });
      toast('Textos guardados. La landing ya los muestra.');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  if (!c) return <p className="muted">Cargando…</p>;
  return (
    <>
      <section className="panel">
        <h2>Textos de la landing</h2>
        <p className="sub">Edita la historia y los textos de cada capítulo. Los cambios se ven al instante en el sitio.</p>
        {GROUPS.map((g) => (
          <fieldset key={g.title} style={{ border: '1px solid var(--line)', borderRadius: 14, margin: '0 0 16px', padding: 16 }}>
            <legend style={{ padding: '0 8px', color: 'var(--cyan)', fontSize: '0.85rem' }}>{g.title}</legend>
            <div className="row">
              {g.fields.map(([k, label, long]) => (
                <label className="f" key={k}>
                  {label}
                  {long ? <textarea value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /> : <input type="text" value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="actions">
          <button className="btn solid" disabled={saving} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar textos'}
          </button>
        </div>
      </section>
      <Events />
    </>
  );
}

function Events() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const empty = { title: '', venue: '', city: '', event_date: '', ticket_url: '', description: '', published: true };
  const [f, setF] = useState(empty);
  const [del, setDel] = useState<EventRow | null>(null);

  const load = () => jf<{ events: EventRow[] }>('/api/admin/events').then((r) => setEvents(r.events.map((e) => ({ ...e, event_date: String(e.event_date).slice(0, 10) })))).catch((e) => toast(e.message, true));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    try {
      await jf('/api/admin/events', { method: 'POST', body: JSON.stringify({ ...f, venue: f.venue || null, city: f.city || null, ticket_url: f.ticket_url || null, description: f.description || null }) });
      setF(empty);
      toast('Evento agregado.');
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const toggle = async (e: EventRow) => {
    await jf(`/api/admin/events/${e.id}`, { method: 'PATCH', body: JSON.stringify({ published: !e.published }) }).catch((x) => toast(x.message, true));
    load();
  };

  return (
    <section className="panel">
      <h2>Eventos y fechas</h2>
      <p className="sub">Aparecen en el capítulo «En cabina». Las fechas futuras se muestran primero.</p>
      <div className="row three">
        <label className="f">Evento<input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="f">Lugar / venue<input type="text" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></label>
        <label className="f">Ciudad<input type="text" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label className="f">Fecha<input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></label>
        <label className="f">Enlace de boletos (opcional)<input type="url" value={f.ticket_url} onChange={(e) => setF({ ...f, ticket_url: e.target.value })} /></label>
        <label className="f">Nota (opcional)<input type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      </div>
      <div className="actions">
        <button className="btn solid" disabled={!f.title || !f.event_date} onClick={add}>Agregar evento</button>
      </div>
      {events.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table className="t">
            <thead><tr><th>Fecha</th><th>Evento</th><th>Lugar</th><th>Visible</th><th /></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.event_date}</td>
                  <td>{e.title}</td>
                  <td>{[e.venue, e.city].filter(Boolean).join(' · ')}</td>
                  <td><button className="btn sm" onClick={() => toggle(e)}>{e.published ? 'Publicado' : 'Oculto'}</button></td>
                  <td><button className="btn sm magenta" onClick={() => setDel(e)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {del && (
        <Confirm title="¿Eliminar este evento?" danger confirmLabel="Eliminar" body={`«${del.title}» dejará de mostrarse en la landing.`} onCancel={() => setDel(null)} onConfirm={async () => {
          await jf(`/api/admin/events/${del.id}`, { method: 'DELETE' }).catch((x) => toast(x.message, true));
          setDel(null);
          load();
        }} />
      )}
    </section>
  );
}
