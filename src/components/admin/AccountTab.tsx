'use client';

import { useState } from 'react';
import { jf, useToast } from './helpers';

export default function AccountTab() {
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  return (
    <section className="panel" style={{ maxWidth: 520 }}>
      <h2>Cambiar mi contraseña</h2>
      <div className="row">
        <label className="f">Contraseña actual<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
        <label className="f">Nueva contraseña (mín. 10 caracteres)<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
      </div>
      <div className="actions">
        <button className="btn solid" disabled={!cur || next.length < 10} onClick={async () => {
          try { await jf('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: cur, next }) }); toast('Contraseña actualizada.'); setCur(''); setNext(''); } catch (e) { toast((e as Error).message, true); }
        }}>Actualizar</button>
      </div>
    </section>
  );
}
