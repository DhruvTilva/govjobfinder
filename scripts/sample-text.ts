import "./env";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";

/** Prints snippets of stored notice text around a regex, for tuning extractors. Usage: sample-text.ts <regex> [status] [limit] */
const [pattern = "post|vacanc", status = "published", limit = "12"] = process.argv.slice(2);
const db = await getDb();
const r = (await db.execute(sql`select n.title, d.doc_text from notices n join discoveries d on d.notice_id = n.id where n.status = ${status} and n.kind = 'recruitment' and d.doc_text is not null order by random() limit ${Number(limit)}`)) as unknown as { rows: { title: string; doc_text: string }[] };
const re = new RegExp(pattern, "gi");
for (const row of r.rows ?? (r as unknown as { title: string; doc_text: string }[])) {
  console.log("\n=== " + row.title.slice(0, 90));
  const hits = [...row.doc_text.matchAll(re)].slice(0, 3);
  for (const h of hits) console.log("  …" + row.doc_text.slice(Math.max(0, h.index! - 80), h.index! + 120).replace(/\s+/g, " ") + "…");
  if (!hits.length) console.log("  (no match) " + row.doc_text.slice(0, 200).replace(/\s+/g, " "));
}
await closeDb();
