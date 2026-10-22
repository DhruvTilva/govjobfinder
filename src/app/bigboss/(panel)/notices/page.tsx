import Link from "next/link";
import { z } from "zod";
import { listAdminNotices } from "@/lib/admin-queries";
import { NOTICE_KINDS, NOTICE_STATUSES } from "@/db/schema";
import { formatDate, KIND_LABEL, timeAgo } from "@/lib/status";
import { Notice, PageTitle, Pill, Table } from "@/components/admin/ui";
import { bulkNoticeAction } from "../../actions";

export const metadata = { title: "Notices" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function NoticesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const f = {
    status: z.enum(NOTICE_STATUSES).optional().catch(undefined).parse(sp.status),
    kind: z.enum(NOTICE_KINDS).optional().catch(undefined).parse(sp.kind),
    q: z.string().max(100).optional().catch(undefined).parse(sp.q),
    reason: z.string().max(200).optional().catch(undefined).parse(sp.reason),
    source: z.coerce.number().int().positive().optional().catch(undefined).parse(sp.source),
    page: z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page),
  };
  const { rows, total, page, pageCount } = await listAdminNotices(f);
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...over })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/bigboss/notices?${p}`;
  };
  return (
    <>
      <PageTitle title={f.status === "needs_review" ? "Review queue" : "Notices"}>
        <Link href="/bigboss/notices/new" className="btn-primary">
          Add notice manually
        </Link>
      </PageTitle>
      {sp.reprocessed && <Notice tone="ok">Notice removed and its link re-queued. It will be processed on the next pipeline run.</Notice>}
      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-5" action="/bigboss/notices">
        <input name="q" defaultValue={f.q} placeholder="Title, advt no, organisation" className="input sm:col-span-2" aria-label="Search" />
        <select name="status" defaultValue={f.status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          {NOTICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={f.kind ?? ""} className="input" aria-label="Kind">
          <option value="">Any kind</option>
          {NOTICE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {f.reason && <input type="hidden" name="reason" value={f.reason} />}
        <button className="btn-secondary">Filter</button>
      </form>
      {f.reason && (
        <p className="mb-3 text-sm">
          Showing reason: <strong>{f.reason}</strong> ·{" "}
          <Link href={qs({ reason: undefined, page: undefined })} className="text-navy-700 underline">
            clear
          </Link>
        </p>
      )}
      <form action={bulkNoticeAction}>
        <input type="hidden" name="back" value={qs({})} />
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{total.toLocaleString("en-IN")} notices · with selected:</span>
          <button name="action" value="publish" className="btn-secondary py-1.5">
            Approve &amp; publish
          </button>
          <button name="action" value="reject" className="btn-secondary py-1.5">
            Reject
          </button>
          <button name="action" value="archive" className="btn-secondary py-1.5">
            Archive
          </button>
          <button name="action" value="unpublish" className="btn-secondary py-1.5">
            Move to review
          </button>
        </div>
        <Table head={["", "Notice", "Kind", "Status", "Last date", "Found", "Review reasons"]}>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2">
                <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.title}`} className="h-4 w-4" />
              </td>
              <td className="max-w-md px-3 py-2">
                <Link href={`/bigboss/notices/${r.id}`} className="font-medium text-navy-700 hover:underline">
                  {r.title}
                </Link>
                <span className="block text-xs text-muted">{r.orgShort ?? r.orgName ?? "—"}</span>
              </td>
              <td className="px-3 py-2 text-xs">{KIND_LABEL[r.kind]}</td>
              <td className="px-3 py-2">
                <Pill value={r.status} />
                {r.verification !== "auto" && <span className="mt-1 block text-xs text-ok">{r.verification}</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{r.applyEnd ? formatDate(r.applyEnd) : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{timeAgo(r.firstSeenAt)}</td>
              <td className="px-3 py-2 text-xs text-muted">{r.reviewReasons.join("; ")}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted">
                No notices match.
              </td>
            </tr>
          )}
        </Table>
      </form>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={qs({ page: page - 1 })} className="btn-secondary">
              Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={qs({ page: page + 1 })} className="btn-secondary">
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
