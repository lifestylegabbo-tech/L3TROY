import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params);
  return rows as T[];
}

export async function q1<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
