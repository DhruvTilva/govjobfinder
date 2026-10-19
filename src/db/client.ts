import path from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

type Holder = { ready?: Promise<DB>; close?: () => Promise<void>; kind?: "postgres" | "pglite" };
const g = globalThis as unknown as { __gjfDb?: Holder };
const holder: Holder = (g.__gjfDb ??= {});

/**
 * Returns the shared Drizzle instance.
 * - DATABASE_URL set   → PostgreSQL (Supabase in production) via postgres.js
 * - DATABASE_URL empty → embedded PGlite at PGLITE_DIR (default ./.data/pglite)
 *   or in-memory when PGLITE_DIR=memory (tests).
 *
 * The instance is created once behind a shared promise: pages run many queries in
 * parallel, and checking a plain variable across the `await import()` let every
 * concurrent caller create (and leak) its own connection pool.
 */
export function getDb(): Promise<DB> {
  holder.ready ??= connect().catch((e) => {
    holder.ready = undefined;
    throw e;
  });
  return holder.ready;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    // Supabase's transaction-mode pooler (port 6543) needs prepare:false, and exactly one query
    // in flight per connection: with pipelined queries it left connections hanging (backend
    // stuck in ClientRead) once ~5 queries queued up, which every page with parallel queries does.
    // postgres.js checks `sent.length < max_pipeline`, so 0 (not 1) means no pipelining. That
    // also disables sql.begin(), so it is only used on the pooler port, where the web app runs
    // no transactions; scripts and migrations use the session pooler (WORKER_DATABASE_URL).
    // max_pipeline is a runtime option missing from the postgres.js type definitions.
    const client = postgres(url, {
      prepare: false,
      ...(isTransactionPooler(url) ? ({ max_pipeline: 0 } as object) : {}),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      onnotice: () => {},
    });
    holder.close = () => client.end({ timeout: 5 });
    holder.kind = "postgres";
    return drizzlePg(client, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory") mkdirSync(dir, { recursive: true });
  const client = dir === "memory" ? new PGlite() : new PGlite(dir);
  await client.waitReady;
  holder.close = () => client.close();
  holder.kind = "pglite";
  // The PGlite and postgres-js Drizzle APIs are query-compatible for our usage.
  return drizzlePglite(client, { schema }) as unknown as DB;
}

/** Supabase's transaction-mode pooler listens on 6543 (session mode and direct use 5432). */
export function isTransactionPooler(url = process.env.DATABASE_URL ?? "") {
  try {
    return new URL(url.trim()).port === "6543";
  } catch {
    return false;
  }
}

export function dbKind() {
  return holder.kind ?? (process.env.DATABASE_URL?.trim() ? "postgres" : "pglite");
}

export async function closeDb() {
  await holder.close?.();
  holder.ready = undefined;
  holder.close = undefined;
}

export { schema };
