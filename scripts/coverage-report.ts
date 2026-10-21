import "./env";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";

/**
 * Writes docs/SOURCE_COVERAGE.md from live database state: which configured sources
 * are working, partially supported, failing or not yet checked.
 *   npx tsx scripts/coverage-report.ts            # writes the file
 *   npx tsx scripts/coverage-report.ts --stdout   # prints instead
 */
type Row = {
  id: number;
  name: string;
  url: string;
  org: string | null;
  state: string | null;
  priority: number;
  trust: string;
  method: string;
  enabled: boolean;
  check_status: string;
  url_status: string;
  last_success: Date | null;
  last_error: string | null;
  failures: number;
  found: number | null;
  links: number;
  published: number;
  review: number;
  failed_docs: number;
  notes: string | null;
  processed: number;
};

const db = await getDb();
const res = (await db.execute(sql`
  select s.id, s.name, s.url, o.name as org, st.name as state, s.priority, s.trust, s.method, s.enabled,
         s.last_check_status as check_status, s.url_status, s.last_success_at as last_success, s.last_error,
         s.consecutive_failures as failures, s.last_check_found as found, s.notes,
         (select count(*)::int from discoveries d where d.source_id = s.id) as links,
         (select count(*)::int from notices n where n.source_id = s.id and n.status in ('published','closed')) as published,
         (select count(*)::int from notices n where n.source_id = s.id and n.status = 'needs_review') as review,
         (select count(*)::int from discoveries d where d.source_id = s.id and d.state = 'failed') as failed_docs,
         (select count(*)::int from discoveries d where d.source_id = s.id and d.state in ('processed','ignored')) as processed
  from sources s
  left join organizations o on o.id = s.organization_id
  left join states st on st.id = o.state_id
  order by s.priority, s.name`)) as unknown as { rows?: Row[] };
const rows: Row[] = res.rows ?? (res as unknown as Row[]);
await closeDb();

type Bucket = "working" | "pending" | "review_only" | "no_notices" | "no_links" | "failing" | "never" | "reference" | "disabled";
function bucket(r: Row): Bucket {
  if (!r.enabled) return "disabled";
  if (r.method === "manual") return "reference";
  if (r.check_status === "never" || (r.check_status === "checking" && !r.last_success)) return "never";
  if (r.check_status === "failed") return "failing";
  if (r.check_status === "no_links") return "no_links";
  if (r.published > 0) return "working";
  if (r.links > 0 && r.processed === 0) return "pending";
  if (r.review > 0) return "review_only";
  return "no_notices";
}
const TITLES: Record<Bucket, [string, string]> = {
  working: ["Working", "Listing loads and at least one notice was auto-published."],
  pending: ["Collected, waiting for processing", "Links were found; their documents have not been processed yet (processing continues in later runs)."],
  review_only: ["Partial: collected, not auto-published", "Links are collected but every item so far needed review (source is set to review, or extraction was incomplete)."],
  no_notices: ["Loads, nothing published yet", "The page loads and links are found, but none has been a publishable notice so far (follow-ups, old or unrelated items)."],
  no_links: ["Partial: loads, no notice links found", "The page loads but no recruitment links matched. Needs a CSS selector, include pattern or a different listing URL."],
  failing: ["Failing", "The most recent check failed (blocked, timed out, TLS or HTTP error). See the error."],
  never: ["Not yet checked", "No check has completed yet."],
  reference: ["Reference only", "Configured as a manual reference link; not crawled."],
  disabled: ["Disabled", "Turned off by an administrator."],
};

const groups = new Map<Bucket, Row[]>();
for (const r of rows) {
  const b = bucket(r);
  groups.set(b, [...(groups.get(b) ?? []), r]);
}
const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "never");
const esc = (s: string | null) => (s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 240);

const lines: string[] = [];
lines.push("# Source coverage report", "");
lines.push(`Generated ${fmtDate(new Date())} from the live database by \`npx tsx scripts/coverage-report.ts\`. Regenerate it after collection runs; do not edit by hand.`, "");
lines.push("| Status | Sources | Meaning |", "|---|---|---|");
for (const b of Object.keys(TITLES) as Bucket[]) lines.push(`| ${TITLES[b][0]} | ${groups.get(b)?.length ?? 0} | ${TITLES[b][1]} |`);
lines.push(`| **Total configured** | **${rows.length}** | |`, "");
const p1 = rows.filter((r) => r.priority === 1 && r.enabled && r.method !== "manual");
lines.push(`Priority-1 sources working: ${p1.filter((r) => bucket(r) === "working").length} of ${p1.length}.`, "");

for (const b of Object.keys(TITLES) as Bucket[]) {
  const list = groups.get(b);
  if (!list?.length) continue;
  lines.push(`## ${TITLES[b][0]} (${list.length})`, "");
  if (b === "failing") {
    lines.push("| ID | Source | State | P | Fails | Error | Notes |", "|---|---|---|---|---|---|---|");
    for (const r of list) lines.push(`| ${r.id} | ${esc(r.name)} | ${r.state ?? "Central"} | ${r.priority} | ${r.failures} | ${esc(r.last_error)} | ${esc(r.notes)} |`);
  } else if (b === "no_links" || b === "disabled") {
    lines.push("| ID | Source | State | P | URL | Notes |", "|---|---|---|---|---|---|");
    for (const r of list) lines.push(`| ${r.id} | ${esc(r.name)} | ${r.state ?? "Central"} | ${r.priority} | ${esc(r.url)} | ${esc(r.notes)} |`);
  } else {
    lines.push("| ID | Source | State | P | Trust | Links | Published | Review | Last success |", "|---|---|---|---|---|---|---|---|---|");
    for (const r of list) lines.push(`| ${r.id} | ${esc(r.name)} | ${r.state ?? "Central"} | ${r.priority} | ${r.trust} | ${r.links} | ${r.published} | ${r.review} | ${fmtDate(r.last_success)} |`);
  }
  lines.push("");
}

const out = lines.join("\n");
if (process.argv.includes("--stdout")) console.log(out);
else {
  writeFileSync("docs/SOURCE_COVERAGE.md", out);
  console.log(`Wrote docs/SOURCE_COVERAGE.md (${rows.length} sources).`);
}
process.exit(0);
