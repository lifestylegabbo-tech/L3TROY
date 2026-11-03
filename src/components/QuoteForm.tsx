'use client';

import { useState } from 'react';

type Svc = { id: string; name: string; description: string | null };

export default function QuoteForm({ services }: { services: Svc[] }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', service_id: '', event_date: '', venue: '', city: '', guests: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No pudimos enviar la solicitud. Intenta de nuevo.');
      setDone(data.number);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="quote-done" role="status">
        <span className="eyebrow">Solicitud recibida</span>
        <h3>Gracias, {f.name.split(' ')[0]}.</h3>
        <p>
          Tu número de solicitud es <b>{done}</b>. Revisaremos los detalles y te responderemos con tu cotización lo antes posible.
        </p>
      </div>
    );
  }

  return (
    <form className="quote-form" onSubmit={submit} noValidate>
      <div className="q-grid">
        <label className="qf">Nombre *<input type="text" value={f.name} onChange={set('name')} autoComplete="name" required /></label>
        <label className="qf">Correo<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="qf">Teléfono / WhatsApp<input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <label className="qf">Tipo de evento
          <select value={f.service_id} onChange={set('service_id')}>
            <option value="">Selecciona…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="qf">Fecha del evento<input type="date" min={today} value={f.event_date} onChange={set('event_date')} /></label>
        <label className="qf">Invitados (aprox.)<input type="number" min={1} inputMode="numeric" value={f.guests} onChange={set('guests')} /></label>
        <label className="qf">Lugar / venue<input type="text" value={f.venue} onChange={set('venue')} /></label>
        <label className="qf">Ciudad<input type="text" value={f.city} onChange={set('city')} /></label>
      </div>
      <label className="qf">Cuéntanos más<textarea rows={4} value={f.message} onChange={set('message')} placeholder="Horario, tipo de música, duración, equipo que necesitas…" /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
      {err && <p className="q-err" role="alert">{err}</p>}
      <button className="btn solid" type="submit" disabled={busy || f.name.trim().length < 2 || (!f.email && !f.phone)}>
        {busy ? 'Enviando…' : 'Solicitar cotización'}
      </button>
      <p className="q-note">Déjanos un correo o un teléfono para poder responderte.</p>
    </form>
  );
}
