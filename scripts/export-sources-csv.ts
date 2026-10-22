import "./env";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";

/** Writes docs/sources.csv: every configured source with its live status. npx tsx scripts/export-sources-csv.ts */
const db = await getDb();
const res = (await db.execute(sql`
  select s.id, s.name, o.name as organization, coalesce(st.name, 'Central') as state, se.name as sector, s.url,
         s.priority, s.trust, s.method, s.enabled, s.url_status, case when s.enabled then s.last_check_status else 'disabled' end as last_check,
         s.last_check_found, s.last_check_new, s.last_checked_at, s.last_success_at, s.consecutive_failures,
         (select count(*)::int from notices n where n.source_id = s.id and n.status = 'published') as published,
         (select count(*)::int from notices n where n.source_id = s.id and n.status = 'needs_review') as in_review,
         s.last_error, s.notes
  from sources s
  left join organizations o on o.id = s.organization_id
  left join states st on st.id = o.state_id
  left join sectors se on se.id = o.sector_id
  order by (st.name is not null), st.name, s.priority, s.name`)) as unknown as { rows?: Record<string, unknown>[] };
const rows = res.rows ?? (res as unknown as Record<string, unknown>[]);
await closeDb();

const cols = ["id", "name", "organization", "state", "sector", "url", "priority", "trust", "method", "enabled", "url_status", "last_check", "last_check_found", "last_check_new", "last_checked_at", "last_success_at", "consecutive_failures", "published", "in_review", "last_error", "notes"];
const cell = (v: unknown) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
writeFileSync("docs/sources.csv", [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n");
console.log(`Wrote docs/sources.csv (${rows.length} sources).`);
process.exit(0);
