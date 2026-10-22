import Link from "next/link";
import { z } from "zod";
import { contentCounts, listContent, referenceOptions } from "@/lib/admin-queries";
import { NOTICE_KINDS, NOTICE_STATUSES } from "@/db/schema";
import { SECTIONS } from "@/lib/content";
import { formatDate, KIND_LABEL, timeAgo } from "@/lib/status";
import { Notice, PageTitle, Pill } from "@/components/admin/ui";
import { bulkContentAction } from "../../content-actions";
import { SubmitButton } from "@/components/SubmitButton";
import Form from "next/form";

export const metadata = { title: "Website content" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export default async function ContentPage({ searchParams }: Props) {
  const sp = await searchParams;
  const f = {
    q: z.string().max(100).optional().catch(undefined).parse(sp.q || undefined),
    kind: z.enum(NOTICE_KINDS).optional().catch(undefined).parse(sp.kind || undefined),
    status: z.enum(NOTICE_STATUSES).optional().catch(undefined).parse(sp.status || undefined),
    stateId: z.coerce.number().int().positive().optional().catch(undefined).parse(sp.stateId || undefined),
    orgId: z.coerce.number().int().positive().optional().catch(undefined).parse(sp.orgId || undefined),
    origin: z.enum(["manual", "auto"]).optional().catch(undefined).parse(sp.origin || undefined),
    from: isoDate.parse(sp.from || undefined),
    to: isoDate.parse(sp.to || undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page || undefined),
  };
  const [{ rows, total, page, pageCount }, opts, counts] = await Promise.all([listContent(f), referenceOptions(), contentCounts()]);
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...over })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/bigboss/content?${p}`;
  };
  const back = qs({});
  const byKind = (kind: string, status?: string) => counts.filter((c) => c.kind === kind && (!status || c.status === status)).reduce((a, c) => a + c.n, 0);

  return (
    <>
      <PageTitle title="Website content">
        <Link href="/bigboss/content/settings" className="btn-secondary">
          Homepage & site settings
        </Link>
        <Link href="/bigboss/content/exams" className="btn-secondary">
          Exam directory
        </Link>
        <Link href="/bigboss/content/new" className="btn-primary">
          Add content
        </Link>
      </PageTitle>
      {sp.deleted && <Notice tone="ok">Notice deleted.</Notice>}
      {sp.bulk === "confirm" && <Notice tone="bad">Type DELETE in the confirmation box to delete the selected notices.</Notice>}
      {sp.bulk === "none" && <Notice tone="bad">Select at least one notice first.</Notice>}
      {sp.bulk && !["confirm", "none"].includes(sp.bulk) && (
        <Notice tone="ok">
          {sp.bulk}: {sp.n ?? 0} notice(s) changed.
        </Notice>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {SECTIONS.map((s) => (
          <div key={s.key} className={`card p-3 text-sm ${f.kind === s.kind ? "ring-2 ring-navy-700" : ""}`}>
            <Link href={qs({ kind: s.kind, page: undefined })} className="font-semibold text-navy-700 hover:underline">
              {s.label}
            </Link>
            <p className="mt-1 text-xs text-muted">
              {byKind(s.kind, "published")} published · {byKind(s.kind, "draft")} drafts · {byKind(s.kind)} total
            </p>
            <Link href={`/bigboss/content/new?section=${s.key}`} className="mt-1 inline-block text-xs font-semibold text-navy-700 underline">
              + Add
            </Link>
          </div>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted">
        Closing Soon, State Jobs and Sectors are not separate content: they list published jobs by last date, state and sector, so set those fields on the job.
      </p>

      <Form className="card mb-4 grid gap-2 p-3 sm:grid-cols-4 xl:grid-cols-8" action="/bigboss/content">
        <input name="q" defaultValue={f.q} placeholder="Title, advt no, keyword, organisation" className="input sm:col-span-2" aria-label="Search" />
        <select name="kind" defaultValue={f.kind ?? ""} className="input" aria-label="Section">
          <option value="">Any section</option>
          {NOTICE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          {NOTICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select name="origin" defaultValue={f.origin ?? ""} className="input" aria-label="Origin">
          <option value="">Manual & collected</option>
          <option value="manual">Added manually</option>
          <option value="auto">Collected automatically</option>
        </select>
        <select name="stateId" defaultValue={f.stateId ?? ""} className="input" aria-label="State">
          <option value="">Any state</option>
          {opts.states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="orgId" defaultValue={f.orgId ?? ""} className="input sm:col-span-2" aria-label="Organisation">
          <option value="">Any organisation</option>
          {opts.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.short ? `${o.short} — ${o.name}` : o.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted">
          From <input type="date" name="from" defaultValue={f.from} className="input" aria-label="Created from" />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          To <input type="date" name="to" defaultValue={f.to} className="input" aria-label="Created to" />
        </label>
        <SubmitButton className="btn-secondary" pendingLabel="Searching…" label="Filter" />
        <Link href="/bigboss/content" className="self-center text-sm text-navy-700 underline">
          Clear
        </Link>
      </Form>

      <form action={bulkContentAction}>
        <input type="hidden" name="back" value={back} />
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{total.toLocaleString("en-IN")} notices · with selected:</span>
          <SubmitButton name="action" value="publish" className="btn-secondary" pendingLabel="Publishing notice…" label="Publish" />
          <SubmitButton name="action" value="unpublish" className="btn-secondary" pendingLabel="Unpublishing…" label="Unpublish" />
          <SubmitButton name="action" value="archive" className="btn-secondary" pendingLabel="Archiving…" label="Archive" />
          <input name="confirm" placeholder="Type DELETE" className="input w-32" aria-label="Type DELETE to confirm" autoComplete="off" />
          <SubmitButton name="action" value="delete" className="btn-secondary text-danger" pendingLabel="Deleting…" label="Delete" />
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2" aria-label="Select" />
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Organisation / state</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.title}`} className="h-4 w-4" />
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <Link href={`/bigboss/content/${r.id}`} className="font-medium text-navy-700 hover:underline">
                      {r.pinned && <span title="Pinned">📌 </span>}
                      {r.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{KIND_LABEL[r.kind]}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.orgShort ?? r.orgName ?? "—"}
                    <span className="block text-muted">{r.stateName ?? "Central / not set"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.manual ? <span className="chip bg-navy-100 text-navy-900">manual</span> : (r.sourceName ?? "collected")}</td>
                  <td className="px-3 py-2">
                    <Pill value={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDate(r.createdAt.toISOString().slice(0, 10))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{timeAgo(r.updatedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.publishedAt ? formatDate(r.publishedAt.toISOString().slice(0, 10)) : "—"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted">
                    No content matches these filters.{" "}
                    <Link href="/bigboss/content/new" className="text-navy-700 underline">
                      Add content
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link className="btn-secondary" href={qs({ page: page - 1 })}>
              Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link className="btn-secondary" href={qs({ page: page + 1 })}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
