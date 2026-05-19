import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Prefer IPv4 (127.0.0.1) over IPv6 (::1) — Node.js pg sometimes resolves localhost to IPv6 first
  // and fails when pg_hba.conf only allows IPv4. Use .env DATABASE_URL to override.
  host: process.env.DATABASE_URL?.includes('127.0.0.1') ? '127.0.0.1' : undefined,
});

// Log pool errors but do not crash — transient connection issues should not
// take down the server; the next request will simply get a fresh connection.
db.on('error', (err) => {
  console.error('Pool error (non-fatal):', err);
});
