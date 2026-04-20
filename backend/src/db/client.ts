import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log pool errors but do not crash — transient connection issues should not
// take down the server; the next request will simply get a fresh connection.
db.on('error', (err) => {
  console.error('Pool error (non-fatal):', err);
});
