import "./env";
import { getDb, closeDb } from "@/db/client";
import { sql } from "drizzle-orm";

/** Prints notices for manual QA. Usage: npx tsx scripts/inspect.ts [status] */
const db = await getDb();
const status = process.argv[2] ?? "published";
const rows = await db.execute(sql`select n.id, n.kind, n.title, n.advt_no, n.total_posts, n.apply_start, n.apply_end, n.exam_date, n.age_min, n.age_max, n.notification_url, n.review_reasons, o.short_name as org
  from notices n left join organizations o on o.id = n.organization_id where n.status = ${status} order by n.id`);
for (const r of (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[])) {
  console.log(`#${r.id} [${r.kind}] ${r.org ?? "-"} | ${String(r.title).slice(0, 110)}`);
  console.log(`    advt=${r.advt_no ?? "-"} posts=${r.total_posts ?? "-"} start=${r.apply_start ?? "-"} end=${r.apply_end ?? "-"} exam=${r.exam_date ?? "-"} age=${r.age_min ?? "-"}-${r.age_max ?? "-"}`);
  console.log(`    ${r.notification_url}`);
  if ((r.review_reasons as string[])?.length) console.log(`    reasons: ${(r.review_reasons as string[]).join("; ")}`);
}
await closeDb();
