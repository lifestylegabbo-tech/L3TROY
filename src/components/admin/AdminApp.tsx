'use client';

import { useState } from 'react';
import { ToastProvider } from './helpers';
import MediaLibrary from './MediaLibrary';
import ContentTab from './ContentTab';
import UsersTab from './UsersTab';
import StorageTab from './StorageTab';
import AccountTab from './AccountTab';

type User = { id: string; name: string; email: string; role: 'admin' | 'editor' };

export default function AdminApp({ user }: { user: User }) {
  const tabs = [
    ['media', 'Media Library'],
    ['content', 'Textos y eventos'],
    ['storage', 'Almacenamiento'],
    ...(user.role === 'admin' ? ([['users', 'Usuarios']] as const) : []),
    ['account', 'Mi cuenta'],
  ] as const;
  const [tab, setTab] = useState<string>('media');
  return (
    <ToastProvider>
      <div className="adm">
        <div className="adm-top">
          <a href="/" className="logo">L<b>3</b>TROY <span className="muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400, letterSpacing: 0, fontSize: '0.8rem' }}>· Panel</span></a>
          <div className="adm-user">
            <span>{user.name} · {user.role === 'admin' ? 'Administrador' : 'Editor'}</span>
            <a className="btn sm" href="/" target="_blank" rel="noreferrer">Ver sitio</a>
            <button className="btn sm" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}>Salir</button>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="adm-body">
          {tab === 'media' && <MediaLibrary />}
          {tab === 'content' && <ContentTab />}
          {tab === 'storage' && <StorageTab isAdmin={user.role === 'admin'} />}
          {tab === 'users' && user.role === 'admin' && <UsersTab meId={user.id} />}
          {tab === 'account' && <AccountTab />}
        </div>
      </div>
    </ToastProvider>
  );
}
