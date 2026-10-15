import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { notices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNotice } from "@/lib/queries";
import { NoticeDetail } from "@/components/NoticeDetail";
import { Notice } from "@/components/admin/ui";

export const metadata = { title: "Preview" };

/** Renders the public page for any notice, including unpublished ones. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = await getDb();
  const [row] = await db.select({ slug: notices.slug, status: notices.status }).from(notices).where(eq(notices.id, id));
  if (!row) notFound();
  const data = await getNotice(row.slug, { includeHidden: true });
  if (!data) notFound();
  return (
    <>
      <Notice tone="warn">Preview — status is “{row.status.replace("_", " ")}”. {row.status === "published" ? "This page is public." : "The public cannot see this page yet."}</Notice>
      <div className="-mx-4 rounded-xl bg-surface sm:-mx-6">
        <NoticeDetail data={data} />
      </div>
    </>
  );
}
