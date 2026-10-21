import { neon } from "@neondatabase/serverless";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import net from "node:net";
import { Pool } from "pg";
import { dbEnv } from "@/lib/env";
import * as schema from "./schema";

// Node tries each resolved address (IPv4 and IPv6) for only 250ms before moving on. On a slow
// link to the Neon region every attempt times out (ETIMEDOUT after ~750ms), so allow longer.
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
  net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
}

/*
 * Two clients, both created lazily so importing this module never needs DATABASE_URL:
 *  - getDb():     node-postgres over TCP with a small pool. Use for writes, transactions
 *                 (version checks, audit rows) and Better Auth.
 *  - getReadDb(): Neon's HTTP driver. One HTTPS request per query, no connection to open,
 *                 so page loads don't pay a connection handshake. No interactive transactions.
 */
let cachedDb: ReturnType<typeof createDb> | undefined;
let cachedReadDb: ReturnType<typeof createReadDb> | undefined;

function createDb() {
  // pg treats sslmode=require as verify-full today but will weaken it to libpq semantics in v9.
  // Neon serves a publicly trusted certificate, so ask for full verification explicitly.
  const url = new URL(dbEnv().DATABASE_URL);
  if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), max: 5, idleTimeoutMillis: 30_000 });
  // On Vercel Fluid compute, closes idle clients before the instance is suspended. No-op elsewhere.
  attachDatabasePool(pool);
  return drizzlePg(pool, { schema });
}

function createReadDb() {
  return drizzleHttp(neon(dbEnv().DATABASE_URL), { schema });
}

export function getDb() {
  cachedDb ??= createDb();
  return cachedDb;
}

export function getReadDb() {
  cachedReadDb ??= createReadDb();
  return cachedReadDb;
}

export type Db = ReturnType<typeof getDb>;
export type ReadDb = ReturnType<typeof getReadDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
