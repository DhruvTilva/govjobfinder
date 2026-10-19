import "./env";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
const db = await getDb();
for (const s of process.argv.slice(2)) { const r: any = await db.execute(sql.raw(s)); console.log(JSON.stringify(r.rows ?? r)); }
await closeDb();
