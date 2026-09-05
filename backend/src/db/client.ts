import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Managed Postgres providers (Neon, Supabase) require SSL; local/Docker Postgres does not
// advertise it, so only require it when NOT pointed at localhost/127.0.0.1.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Prefer IPv4 (127.0.0.1) over IPv6 (::1) — Node.js pg sometimes resolves localhost to IPv6 first
  // and fails when pg_hba.conf only allows IPv4. Use .env DATABASE_URL to override.
  host: process.env.DATABASE_URL?.includes('127.0.0.1') ? '127.0.0.1' : undefined,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Log pool errors but do not crash — transient connection issues should not
// take down the server; the next request will simply get a fresh connection.
db.on('error', (err) => {
  logger.error('Pool error (non-fatal)', { message: err.message });
});
