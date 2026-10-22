import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminNotice, referenceOptions } from "@/lib/admin-queries";
import { formatDateTime, KIND_LABEL, noticeHref } from "@/lib/status";
import { safeHref } from "@/lib/url";
import { PUBLIC_STATUSES } from "@/lib/queries";
import { NoticeEditor } from "@/components/admin/NoticeEditor";
import { Notice, PageTitle, Pill } from "@/components/admin/ui";
import { noticeStatusAction, reprocessNotice } from "../../../actions";

export const metadata = { title: "Edit notice" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

const ACTIONS: { action: string; label: string; show: (s: string) => boolean; cls?: string }[] = [
  { action: "publish", label: "Approve & publish", show: (s) => s !== "published", cls: "btn-primary" },
  { action: "unpublish", label: "Unpublish (back to review)", show: (s) => s === "published" },
  { action: "close", label: "Mark closed", show: (s) => s === "published" },
  { action: "cancel", label: "Mark cancelled", show: (s) => ["published", "closed"].includes(s) },
  { action: "withdraw", label: "Mark withdrawn", show: (s) => ["published", "closed"].includes(s) },
  { action: "archive", label: "Archive", show: (s) => !["archived"].includes(s) },
  { action: "reject", label: "Reject", show: (s) => ["needs_review", "discovered", "extracted", "archived"].includes(s) },
];

export default async function EditNoticePage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [data, opts] = await Promise.all([getAdminNotice(id), referenceOptions()]);
  if (!data) notFound();
  const { n } = data;
  const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(n.status);
  const canReprocess = n.verification === "auto" && ["needs_review", "archived", "rejected"].includes(n.status) && !!n.dedupeKey;

  return (
    <>
      <PageTitle title={`Notice #${n.id}`}>
        <Link href={`/bigboss/notices/${n.id}/preview`} className="btn-secondary">
          Preview
        </Link>
        {isPublic && (
          <Link href={noticeHref(n)} className="btn-secondary" target="_blank">
            Public page ↗
          </Link>
        )}
      </PageTitle>
      {sp.saved && <Notice tone="ok">Notice created.</Notice>}
      {sp.status && <Notice tone="ok">Status updated ({sp.status}).</Notice>}
      {sp.error === "reprocess" && <Notice tone="bad">Only unpublished, auto-collected notices can be reprocessed.</Notice>}

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill value={n.status} />
          <span className="chip bg-slate-100 text-slate-700">{KIND_LABEL[n.kind]}</span>
          <span className="chip bg-slate-100 text-slate-700">verification: {n.verification}</span>
          {n.extractionConfidence != null && <span className="text-xs text-muted">classification confidence {Math.round(n.extractionConfidence * 100)}%</span>}
        </div>
        <p className="mt-2 font-semibold text-ink">{n.title}</p>
        {n.reviewReasons.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-urgent">
            {n.reviewReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Source: {data.sourceName ?? "manual"} · first seen {formatDateTime(n.firstSeenAt)} · updated {formatDateTime(n.updatedAt)}
          {n.publishedAt && ` · published ${formatDateTime(n.publishedAt)}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIONS.filter((a) => a.show(n.status)).map((a) => (
            <form key={a.action} action={noticeStatusAction}>
              <input type="hidden" name="id" value={n.id} />
              <input type="hidden" name="action" value={a.action} />
              <button className={a.cls ?? "btn-secondary"}>{a.label}</button>
            </form>
          ))}
          {canReprocess && (
            <form action={reprocessNotice}>
              <input type="hidden" name="id" value={n.id} />
              <button className="btn-secondary" title="Delete this draft and re-run collection on its link with the current rules">
                Reprocess with current rules
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
        <NoticeEditor n={n} opts={opts} qualIds={data.qualIds} />
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-bold">Source evidence</h2>
            {data.evidence.length === 0 && <p className="text-sm text-muted">Created manually; no harvested source.</p>}
            {data.evidence.map((d) => (
              <div key={d.id} className="mb-3 border-b border-line pb-3 text-sm last:border-0">
                <p className="text-xs text-muted">Link text on source page</p>
                <p className="text-ink">{d.linkText}</p>
                <a href={safeHref(d.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-xs text-navy-700 underline">
                  {d.url}
                </a>
                <p className="mt-1 text-xs text-muted">
                  {d.docContentType ?? "not fetched"} · attempts {d.attempts}
                  {d.lastError && ` · last error: ${d.lastError}`}
                </p>
                {d.docText && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-navy-700">Extracted document text ({d.docText.length.toLocaleString()} chars)</summary>
                    <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-navy-50 p-2 text-xs">{d.docText}</pre>
                  </details>
                )}
              </div>
            ))}
          </section>
          {data.children.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 text-lg font-bold">Linked follow-ups</h2>
              <ul className="space-y-1 text-sm">
                {data.children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/bigboss/notices/${c.id}`} className="text-navy-700 hover:underline">
                      {KIND_LABEL[c.kind]}: {c.title}
                    </Link>{" "}
                    <Pill value={c.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-bold">Change history</h2>
            <ul className="space-y-2 text-sm">
              {data.revisions.map((r) => (
                <li key={r.id}>
                  <span className="text-xs text-muted">
                    {formatDateTime(r.createdAt)} · {r.actor}
                  </span>
                  <span className="block font-semibold text-ink">{r.changeType.replace(/_/g, " ")}</span>
                  {Object.entries(r.diff).map(([k, [a, b]]) => (
                    <span key={k} className="block break-words text-xs text-muted">
                      {k}: {String(a ?? "—").slice(0, 80)} → {String(b ?? "—").slice(0, 80)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
