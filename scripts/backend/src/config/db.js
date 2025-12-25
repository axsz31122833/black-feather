import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pgp = pgPromise({
  capSQL: true,
});

// Prefer DATABASE_URL (Railway/Heroku style). Fallback to individual PG_* vars.
// Enable SSL in cloud environments (Railway Postgres requires SSL).
// Prefer public URL when available (local machine cannot resolve postgres.railway.internal)
// Fallback to DATABASE_URL, then individual PG_* vars.
let cn;
const urlFromEnv = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (urlFromEnv) {
  cn = {
    connectionString: urlFromEnv,
    // Railway Postgres requires SSL; rejectUnauthorized=false for managed certs
    ssl: { rejectUnauthorized: false },
  };
} else {
  cn = {
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? 5432),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

export const db = pgp(cn);