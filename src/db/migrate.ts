import path from "node:path";
import { getDb, dbKind } from "./client";

/** Applies pending SQL migrations from ./drizzle using the active driver. */
export async function runMigrations() {
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
