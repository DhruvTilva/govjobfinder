import "./env";
import { asc } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
import { sources } from "@/db/schema";
import { validateSourceUrl, mapLimit } from "@/pipeline/validate";

/** Checks every source URL and records the result. Usage: npm run sources:validate [-- --json] */
const db = await getDb();
const rows = await db.select({ id: sources.id, name: sources.name, url: sources.url }).from(sources).orderBy(asc(sources.id));
const results = await mapLimit(rows, 8, async (r) => {
  const res = await validateSourceUrl(db, r.id, r.url);
  if (res.status !== "ok") console.log(`${res.status.padEnd(8)} ${r.url}  ${res.finalUrl ?? res.error ?? ""}`);
  return { ...r, ...res };
});
const tally = results.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
console.log(`\nChecked ${results.length} source URLs:`, tally);
if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
await closeDb();
