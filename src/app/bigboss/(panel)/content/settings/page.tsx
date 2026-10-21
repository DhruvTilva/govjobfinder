import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notices } from "@/db/schema";
import { getSiteSettings } from "@/lib/content";
import { KIND_LABEL } from "@/lib/status";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageTitle, Pill } from "@/components/admin/ui";
import { saveSettingsAction } from "../../../content-actions";

export const metadata = { title: "Homepage & site settings" };

export default async function SettingsPage() {
  const db = await getDb();
  const [settings, pinned] = await Promise.all([
    getSiteSettings(db),
    db
      .select({ id: notices.id, title: notices.title, kind: notices.kind, status: notices.status })
      .from(notices)
      .where(and(eq(notices.pinned, true), inArray(notices.status, ["published", "draft", "needs_review"])))
      .orderBy(desc(notices.updatedAt))
      .limit(50),
  ]);
  const rows = [...settings.popularSearches, ...Array.from({ length: Math.max(0, 16 - settings.popularSearches.length) }, () => ({ en: "", hi: "", q: "" }))].slice(0, 16);
  const a = settings.announcement;
  return (
    <>
      <PageTitle title="Homepage & site settings">
        <Link href="/bigboss/content" className="btn-secondary">
          Back to content
        </Link>
      </PageTitle>
      <ActionForm action={saveSettingsAction} className="space-y-5" submitLabel="Save settings">
        <section className="card p-5">
          <h2 className="text-lg font-bold">Announcement banner</h2>
          <p className="mb-3 text-sm text-muted">Shown at the top of every public page while active. Leave the text empty to remove it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Text (English)</span>
              <input name="bannerText" defaultValue={a?.text ?? ""} maxLength={300} className="input" />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Text (Hindi, optional)</span>
              <input name="bannerTextHi" defaultValue={a?.textHi ?? ""} maxLength={300} className="input" />
            </label>
            <label className="block">
              <span className="label">Link (optional, e.g. /jobs?q=ssc or https://…)</span>
              <input name="bannerUrl" defaultValue={a?.url ?? ""} className="input" />
            </label>
            <label className="block">
              <span className="label">Style</span>
              <select name="bannerTone" defaultValue={a?.tone ?? "info"} className="input">
                <option value="info">Information</option>
                <option value="urgent">Important</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="bannerActive" defaultChecked={a?.active ?? false} className="h-4 w-4" /> Show the banner
            </label>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Popular searches (homepage)</h2>
          <p className="mb-3 text-sm text-muted">The quick-search chips under the homepage search box. Empty rows are ignored.</p>
          <div className="space-y-2">
            {rows.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <input name="popEn" defaultValue={p.en} placeholder="Label (English)" maxLength={40} className="input" aria-label={`Popular search ${i + 1} English label`} />
                <input name="popHi" defaultValue={p.hi} placeholder="Label (Hindi)" maxLength={40} className="input" aria-label={`Popular search ${i + 1} Hindi label`} />
                <input name="popQ" defaultValue={p.q} placeholder="Search query" maxLength={80} className="input" aria-label={`Popular search ${i + 1} query`} />
              </div>
            ))}
          </div>
        </section>
      </ActionForm>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-bold">Pinned notices</h2>
        <p className="mb-3 text-sm text-muted">Pinned notices are listed first on their page and on the homepage boards. Pin or unpin one in its editor.</p>
        <ul className="space-y-1 text-sm">
          {pinned.map((p) => (
            <li key={p.id}>
              <Link href={`/bigboss/content/${p.id}`} className="text-navy-700 hover:underline">
                {p.title}
              </Link>{" "}
              <span className="text-xs text-muted">{KIND_LABEL[p.kind]}</span> <Pill value={p.status} />
            </li>
          ))}
          {!pinned.length && <li className="text-muted">Nothing is pinned.</li>}
        </ul>
      </section>
    </>
  );
}
