'use client';

import { useState } from 'react';
import { ToastProvider } from './helpers';
import QuotesTab from './QuotesTab';
import ClientsTab from './ClientsTab';
import MediaLibrary from './MediaLibrary';
import ContentTab from './ContentTab';
import UsersTab from './UsersTab';
import StorageTab from './StorageTab';
import AccountTab from './AccountTab';

const ROLE_NAMES = { admin: 'Administrador', productor: 'Productor', manager: 'Manager' } as const;
type User = { id: string; name: string; email: string; role: 'admin' | 'productor' | 'manager' };

export default function AdminApp({ user }: { user: User }) {
  const tabs = [
    ['media', 'Media Library'],
    ['quotes', 'Cotizaciones'],
    ['clients', 'Clientes'],
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
          <a href="/" className="adm-brand" aria-label="L3TROY, ir al sitio">
            <span className="adm-logo">L<b>3</b>TROY</span>
            <span className="adm-tag">Panel</span>
          </a>
          <div className="adm-actions">
            <a className="btn sm" href="/" target="_blank" rel="noreferrer">Ver sitio ↗</a>
            <button className="btn sm" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}>Salir</button>
          </div>
          <div className="adm-who">
            <span className="adm-av" aria-hidden>{user.name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="adm-name">
              <b>{user.name}</b>
              {user.name.trim().toLowerCase() !== ROLE_NAMES[user.role].toLowerCase() && <small>{ROLE_NAMES[user.role]}</small>}
            </span>
            <span className={`adm-role ${user.role}`}>{user.role === 'admin' ? 'Admin' : ROLE_NAMES[user.role]}</span>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="adm-body">
          {tab === 'media' && <MediaLibrary />}
          {tab === 'quotes' && <QuotesTab isAdmin={user.role === 'admin'} />}
          {tab === 'clients' && <ClientsTab isAdmin={user.role === 'admin'} />}
          {tab === 'content' && <ContentTab />}
          {tab === 'storage' && <StorageTab isAdmin={user.role === 'admin'} />}
          {tab === 'users' && user.role === 'admin' && <UsersTab meId={user.id} />}
          {tab === 'account' && <AccountTab />}
        </div>
      </div>
    </ToastProvider>
  );
}
