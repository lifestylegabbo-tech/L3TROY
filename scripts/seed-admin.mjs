import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv('.env.local');

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan DATABASE_URL, ADMIN_EMAIL o ADMIN_PASSWORD');
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const existing = await sql.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL.toLowerCase()]);
if (existing.length) {
  console.log('El administrador ya existe; no se modifica.');
} else {
  await sql.query("INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'admin')", [
    ADMIN_EMAIL.toLowerCase(),
    ADMIN_NAME || 'Administrador',
    hash,
  ]);
  console.log('Administrador creado:', ADMIN_EMAIL);
}
