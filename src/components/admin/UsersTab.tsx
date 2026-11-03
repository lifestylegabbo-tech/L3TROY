'use client';

import { useCallback, useEffect, useState } from 'react';
import { Confirm, jf, useToast } from './helpers';

type U = { id: string; email: string; name: string; role: 'admin' | 'editor'; active: boolean; created_at: string; last_login_at: string | null };

export default function UsersTab({ meId }: { meId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<U[]>([]);
  const [f, setF] = useState({ name: '', email: '', role: 'editor', password: '' });
  const [del, setDel] = useState<U | null>(null);
  const [reset, setReset] = useState<U | null>(null);
  const [newPw, setNewPw] = useState('');

  const load = useCallback(() => jf<{ users: U[] }>('/api/admin/users').then((r) => setUsers(r.users)).catch((e) => toast(e.message, true)), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const gen = () => {
    const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    setF((x) => ({ ...x, password: Array.from(bytes, (b) => a[b % a.length]).join('') }));
  };

  const create = async () => {
    try {
      await jf('/api/admin/users', { method: 'POST', body: JSON.stringify(f) });
      toast(`Usuario creado. Comparte la contraseña inicial de forma segura: ${f.password}`);
      setF({ name: '', email: '', role: 'editor', password: '' });
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const patch = async (u: U, body: object) => {
    try {
      await jf(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Crear usuario</h2>
        <p className="sub">
          <b>Administrador</b>: todo, incluidos usuarios y formatos. <b>Editor</b>: sube, edita y publica contenido.
        </p>
        <div className="row two">
          <label className="f">Nombre<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="f">Correo<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="f">Rol
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="f">Contraseña inicial (mín. 10 caracteres)
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
              <button type="button" className="btn sm" onClick={gen}>Generar</button>
            </div>
          </label>
        </div>
        <div className="actions">
          <button className="btn solid" disabled={!f.name || !f.email || f.password.length < 10} onClick={create}>Crear usuario</button>
        </div>
      </section>

      <section className="panel">
        <h2>Usuarios</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.id === meId && <span className="badge" style={{ marginLeft: 8 }}>tú</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} disabled={u.id === meId} onChange={(e) => patch(u, { role: e.target.value })} style={{ width: 'auto' }}>
                      <option value="editor">Editor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td><span className={`badge ${u.active ? 'published' : 'archived'}`}>{u.active ? 'Activo' : 'Desactivado'}</span></td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-GT') : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm" onClick={() => { setReset(u); setNewPw(''); }}>Contraseña</button>{' '}
                    {u.id !== meId && (
                      <>
                        <button className="btn sm" onClick={() => patch(u, { active: !u.active })}>{u.active ? 'Desactivar' : 'Activar'}</button>{' '}
                        <button className="btn sm magenta" onClick={() => setDel(u)}>Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {del && (
        <Confirm title="¿Eliminar usuario?" danger confirmLabel="Eliminar" body={`${del.name} (${del.email}) perderá el acceso. Sus archivos subidos se conservan.`} onCancel={() => setDel(null)} onConfirm={async () => {
          try { await jf(`/api/admin/users/${del.id}`, { method: 'DELETE' }); toast('Usuario eliminado.'); } catch (e) { toast((e as Error).message, true); }
          setDel(null);
          load();
        }} />
      )}
      {reset && (
        <div className="modal-bg" onClick={() => setReset(null)}>
          <div className="modal sm" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Nueva contraseña para {reset.name}</h3>
            <label className="f">Contraseña (mín. 10 caracteres)<input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></label>
            <div className="actions">
              <button className="btn solid" disabled={newPw.length < 10} onClick={async () => { await patch(reset, { password: newPw }); toast('Contraseña actualizada.'); setReset(null); }}>Guardar</button>
              <button className="btn" onClick={() => setReset(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
