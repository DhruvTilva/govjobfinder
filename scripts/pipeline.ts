import "./env";
import { getDb, closeDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { runPipeline } from "@/pipeline/run";
import { requeueForReprocessing } from "@/pipeline/process";

/**
 * Runs one pipeline pass. Used by the scheduled GitHub Action.
 *   npm run pipeline                       # due sources
 *   npm run pipeline -- --source 12,15     # specific sources
 *   npm run pipeline -- --max 20 --budget 10
 *   npm run pipeline -- --reprocess-review # re-extract unedited review/archived items first
 *   npm run pipeline -- --reprocess-published  # …and unedited published items (after an extraction fix)
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

await runMigrations();
const db = await getDb();
if (process.argv.includes("--reprocess-published")) {
  console.log(`Re-queued ${await requeueForReprocessing(db, ["needs_review", "archived", "published"])} notice(s) for reprocessing.`);
} else if (process.argv.includes("--reprocess-review")) {
  console.log(`Re-queued ${await requeueForReprocessing(db, ["needs_review", "archived"])} notice(s) for reprocessing.`);
}
const sourceIds = arg("source")?.split(",").map(Number).filter(Boolean);
const result = await runPipeline(db, {
  trigger: process.env.GITHUB_EVENT_NAME === "schedule" ? "schedule" : "manual",
  sourceIds,
  maxSources: arg("max") ? Number(arg("max")) : undefined,
  processLimit: arg("process") ? Number(arg("process")) : undefined,
  timeBudgetMs: arg("budget") ? Number(arg("budget")) * 60_000 : undefined,
});
console.log(JSON.stringify(result, null, 2));
await closeDb();
process.exit(result.status === "failed" ? 1 : 0);
