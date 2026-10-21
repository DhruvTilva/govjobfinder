import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notices, organizations } from "@/db/schema";
import { currentAdmin } from "@/lib/auth";
import { PUBLIC_STATUSES } from "@/lib/queries";
import { readUpload } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serves an uploaded file: a notice PDF (public only while a public notice uses it) or an
 * organisation logo (public while it is that organisation's visible logo). Anything else is only
 * served to signed-in admins, so drafts' attachments and hidden logos are not exposed.
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
  const [logoUse] = publicUse
    ? []
    : await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.logoId, id), inArray(organizations.logoSource, ["auto", "admin"])))
        .limit(1);
  const admin = publicUse || logoUse ? null : await currentAdmin();
  if (!publicUse && !logoUse && !admin) return new Response("Not found", { status: 404 });
  const file = await readUpload(db, id);
  if (!file) return new Response("Not found", { status: 404 });
  const isImage = file.contentType.startsWith("image/");
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": isImage ? file.contentType : "application/pdf",
      "content-disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
      // A changed logo gets a new id, so logos can be cached for a long time.
      "cache-control": logoUse ? "public, max-age=604800, immutable" : publicUse ? "public, max-age=3600" : "private, no-store",
    },
  });
}
