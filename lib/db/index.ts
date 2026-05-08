import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Use the direct Postgres connection string (e.g. from Supabase: Project Settings → Database)."
    );
  }
  return url;
}

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

function createPool(): Pool {
  const connectionString = getDatabaseUrl();
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

/**
 * Drizzle DB instance with schema. Use this for all queries.
 */
export const db = drizzle(pool, { schema });
export type Db = typeof db;
