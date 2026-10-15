import "./env";
import { getDb, closeDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedReferenceData } from "@/db/seed";

await runMigrations();
const counts = await seedReferenceData(await getDb());
console.log("Inserted (new rows only):", counts);
await closeDb();
