import path from "node:path";
import { getDb, dbKind, isTransactionPooler } from "./client";

/** Applies pending SQL migrations from ./drizzle using the active driver. */
export async function runMigrations() {
  if (isTransactionPooler()) {
    throw new Error("Migrations need a session connection: set WORKER_DATABASE_URL to the Supabase session pooler URL (port 5432).");
  }
  const db = await getDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (dbKind() === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder });
  }
}
