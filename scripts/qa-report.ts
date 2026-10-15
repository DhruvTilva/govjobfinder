import "./env";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";

/** Summarises pipeline output quality: review reasons, kinds, field coverage. */
const db = await getDb();
const q = async (s: ReturnType<typeof sql>) => {
  const r = (await db.execute(s)) as unknown as { rows?: Record<string, unknown>[] };
  return r.rows ?? (r as unknown as Record<string, unknown>[]);
};
console.log("By status/kind:", await q(sql`select status, kind, count(*)::int n from notices group by 1,2 order by 1,2`));
console.log("Review reasons:", await q(sql`select r reason, count(*)::int n from notices, unnest(review_reasons) r where status='needs_review' group by 1 order by 2 desc`));
console.log("Published recruitment field coverage:", await q(sql`select count(*)::int total, count(apply_end)::int apply_end, count(total_posts)::int posts, count(advt_no)::int advt, count(age_max)::int age, count(fee_text)::int fee, count(qualification_text)::int qual, count(sector_id)::int sector from notices where status='published' and kind='recruitment'`));
console.log("Sample review titles:", (await q(sql`select title from notices where status='needs_review' order by random() limit 15`)).map((r) => String(r.title).slice(0, 110)));
await closeDb();
