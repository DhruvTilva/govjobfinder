import "./env";
import { eq, inArray } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
import { notices, noticeRevisions } from "@/db/schema";

/**
 * Reverts notices that the e2e test edited and published (it writes a marker fee
 * text and a made-up closing date). Run after `npm run e2e` on any shared database.
 */
const MARKER = "No fee (edited in end-to-end test)";
const db = await getDb();
const rows = await db.select({ id: notices.id, title: notices.title }).from(notices).where(eq(notices.feeText, MARKER));
const ids = rows.map((r) => r.id);
if (ids.length) {
  await db
    .update(notices)
    .set({ status: "rejected", feeText: null, applyEnd: null, verification: "auto", reviewReasons: ["Edited by automated end-to-end test; not a real review"] })
    .where(inArray(notices.id, ids));
  await db.insert(noticeRevisions).values(ids.map((noticeId) => ({ noticeId, changeType: "status", diff: { status: ["published", "rejected"] as [unknown, unknown] }, actor: "e2e-cleanup" })));
}
console.log(`Reverted ${ids.length} e2e-edited notice(s).`, rows.map((r) => `#${r.id}`).join(" "));
await closeDb();
