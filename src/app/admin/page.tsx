import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import AdminApp from '@/components/admin/AdminApp';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Panel · L3TROY', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const s = await getSession();
  if (!s) redirect('/admin/login');
  return <AdminApp user={s} />;
}
