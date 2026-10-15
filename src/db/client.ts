import path from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

type Holder = { db?: DB; close?: () => Promise<void>; kind?: "postgres" | "pglite" };
const g = globalThis as unknown as { __gjfDb?: Holder };
const holder: Holder = (g.__gjfDb ??= {});

/**
 * Returns the shared Drizzle instance.
 * - DATABASE_URL set   → PostgreSQL (Supabase in production) via postgres.js
 * - DATABASE_URL empty → embedded PGlite at PGLITE_DIR (default ./.data/pglite)
 *   or in-memory when PGLITE_DIR=memory (tests).
 */
export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare:false keeps us compatible with Supabase's transaction-mode pooler.
    const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5), idle_timeout: 20 });
    holder.db = drizzlePg(client, { schema });
    holder.close = () => client.end({ timeout: 5 });
    holder.kind = "postgres";
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    if (dir !== "memory") mkdirSync(dir, { recursive: true });
    const client = dir === "memory" ? new PGlite() : new PGlite(dir);
    await client.waitReady;
    // The PGlite and postgres-js Drizzle APIs are query-compatible for our usage.
    holder.db = drizzlePglite(client, { schema }) as unknown as DB;
    holder.close = () => client.close();
    holder.kind = "pglite";
  }
  return holder.db;
}

export function dbKind() {
  return holder.kind ?? (process.env.DATABASE_URL?.trim() ? "postgres" : "pglite");
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

export { schema };
