import "./env";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
const db = await getDb();
const r: any = await db.execute(sql.raw(`select n.id, left(n.title,70) t, n.notification_url, d.url, d.doc_content_type, length(d.doc_text) len, d.doc_text from notices n join discoveries d on d.notice_id=n.id where n.title ilike '${process.argv[2]}' and n.kind='recruitment' limit 1`));
const row = (r.rows ?? r)[0];
if (!row) { console.log("none"); process.exit(0); }
const t: string = row.doc_text ?? "";
console.log(row.id, row.t, row.doc_content_type, row.len, row.url, "\n---");
const hits = [...t.matchAll(/[^\n]{0,100}\d{1,2}[./-]\d{1,2}[./-]\d{2,4}[^\n]{0,60}/g)].map((m) => m[0].replace(/\s+/g, " ")).slice(0, 8);
console.log(hits.join("\n") || t.slice(0, 600));
await closeDb();
