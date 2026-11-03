import { q, q1 } from '@/lib/db';

export const QUOTE_STATUSES = [
  ['nueva', 'Nueva'],
  ['en_revision', 'En revisión'],
  ['enviada', 'Enviada'],
  ['aceptada', 'Aceptada'],
  ['rechazada', 'Rechazada'],
  ['vencida', 'Vencida'],
] as const;

export type QuoteItem = { description: string; qty: number; price: number };

export function cleanItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((i: any) => ({
      description: String(i?.description ?? '').trim().slice(0, 200),
      qty: Math.max(0, Number(i?.qty) || 0),
      price: Math.max(0, Number(i?.price) || 0),
    }))
    .filter((i) => i.description);
}

export function totalOf(items: QuoteItem[]) {
  return Math.round(items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;
}

/** Busca un cliente por correo; si no existe lo crea. Devuelve su id. */
export async function upsertClient(c: { name: string; email?: string | null; phone?: string | null; company?: string | null }, source: string) {
  const email = c.email?.trim().toLowerCase() || null;
  if (email) {
    const found = await q1<{ id: string }>('SELECT id FROM clients WHERE lower(email) = $1', [email]);
    if (found) {
      await q(
        `UPDATE clients SET phone = COALESCE(NULLIF(phone, ''), $2), company = COALESCE(NULLIF(company, ''), $3), updated_at = now() WHERE id = $1`,
        [found.id, c.phone || null, c.company || null],
      );
      return found.id;
    }
  }
  const row = await q1<{ id: string }>(
    'INSERT INTO clients (name, email, phone, company, source) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [c.name.trim(), email, c.phone?.trim() || null, c.company?.trim() || null, source],
  );
  return row!.id;
}
