import "./env";
import { runMigrations } from "@/db/migrate";
import { closeDb, dbKind } from "@/db/client";

await runMigrations();
console.log(`Migrations applied (${dbKind()}).`);
await closeDb();
