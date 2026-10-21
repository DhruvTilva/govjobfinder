import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notices } from "@/db/schema";
import { currentAdmin } from "@/lib/auth";
import { PUBLIC_STATUSES } from "@/lib/queries";
import { readUpload } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serves an editor-uploaded PDF. Public only while a public notice uses it; otherwise only to
 * signed-in admins (so drafts' attachments are not exposed).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [publicUse] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(eq(notices.attachmentId, id), inArray(notices.status, [...PUBLIC_STATUSES])))
    .limit(1);
  const admin = publicUse ? null : await currentAdmin();
  if (!publicUse && !admin) return new Response("Not found", { status: 404 });
  const file = await readUpload(db, id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
      "cache-control": publicUse ? "public, max-age=3600" : "private, no-store",
    },
  });
}
