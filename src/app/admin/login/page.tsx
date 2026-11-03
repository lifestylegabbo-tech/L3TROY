'use client';

import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) location.href = '/admin';
    else {
      setError(data.error || 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>L<span style={{ color: 'var(--cyan)', textShadow: '0 0 12px var(--cyan)' }}>3</span>TROY</h1>
        <p className="muted" style={{ marginTop: 0 }}>Panel de administración</p>
        <div className="row" style={{ marginTop: 18 }}>
          <label className="f">Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label className="f">Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="actions">
          <button className="btn solid" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
        </div>
      </form>
    </div>
  );
}
