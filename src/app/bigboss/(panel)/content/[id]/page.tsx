import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminNotice, getUploadMeta, referenceOptions } from "@/lib/admin-queries";
import { isManual, SECTIONS, sectionForKind } from "@/lib/content";
import type { NoticeKind } from "@/db/schema";
import { PUBLIC_STATUSES } from "@/lib/queries";
import { formatDateTime, KIND_LABEL, noticeHref } from "@/lib/status";
import { ContentEditor, type EditorNotice } from "@/components/admin/ContentEditor";
import { Notice, PageTitle, Pill } from "@/components/admin/ui";
import { contentStatusAction, deleteContentAction, duplicateContentAction } from "../../../content-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { IdemToken } from "@/components/IdemToken";

export const metadata = { title: "Edit content" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

const SAVED: Record<string, string> = { draft: "Draft saved.", publish: "Published.", duplicate: "Copy created as a draft — edit and publish it when ready." };

export default async function EditContentPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const [data, opts] = await Promise.all([getAdminNotice(id), referenceOptions()]);
  if (!data) notFound();
  const { n } = data;
  const attachment = await getUploadMeta(n.attachmentId);
  const manual = isManual(n);
  const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(n.status);
  const sections: { kind: NoticeKind; label: string }[] = SECTIONS.map((s) => ({ kind: s.kind, label: s.label }));
  if (!sectionForKind(n.kind)) sections.push({ kind: n.kind, label: KIND_LABEL[n.kind] });
  const suggestions = data.revisions.filter((r) => r.changeType === "pipeline_suggestion");

  return (
    <>
      <PageTitle title={`Content #${n.id}`}>
        <Link href={`/bigboss/notices/${n.id}/preview`} className="btn-secondary" target="_blank">
          Preview
        </Link>
        {isPublic && (
          <Link href={noticeHref(n)} className="btn-secondary" target="_blank">
            Public page ↗
          </Link>
        )}
        <form action={duplicateContentAction}>
          <IdemToken />
          <input type="hidden" name="id" value={n.id} />
          <SubmitButton className="btn-secondary" pendingLabel="Duplicating…" label="Duplicate" />
        </form>
        <Link href="/bigboss/content" className="btn-secondary">
          Back to list
        </Link>
      </PageTitle>
      {sp.saved && SAVED[sp.saved] && <Notice tone="ok">{SAVED[sp.saved]}</Notice>}
      {sp.status && <Notice tone="ok">Status changed ({sp.status}).</Notice>}
      {sp.error === "confirm" && <Notice tone="bad">Type DELETE to confirm deletion.</Notice>}

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill value={n.status} />
          <span className="chip bg-slate-100 text-slate-700">{sectionForKind(n.kind)?.label ?? KIND_LABEL[n.kind]}</span>
          {manual ? (
            <span className="chip bg-navy-100 text-navy-900">Added manually</span>
          ) : (
            <span className="chip bg-slate-100 text-slate-700">Collected from {data.sourceName ?? "an official source"}</span>
          )}
          {n.pinned && <span className="chip bg-urgent-soft text-urgent">Pinned</span>}
        </div>
        <p className="mt-2 text-xs text-muted">
          Created {formatDateTime(n.createdAt)} · updated {formatDateTime(n.updatedAt)}
          {n.publishedAt && ` · published ${formatDateTime(n.publishedAt)}`}
          {!manual && data.sourceUrl && (
            <>
              {" "}
              · source page{" "}
              <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                {data.sourceUrl}
              </a>
            </>
          )}
        </p>
        {!manual && <p className="mt-1 text-xs text-muted">Fields you change here are marked “edited” and the pipeline will not overwrite them; it records any different value it finds under Pipeline suggestions.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {n.status !== "published" && (
            <form action={contentStatusAction}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitButton name="action" value="publish" className="btn-primary" pendingLabel="Publishing notice…" label="Publish" />
            </form>
          )}
          {n.status === "published" && (
            <form action={contentStatusAction}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitButton name="action" value="unpublish" className="btn-secondary" pendingLabel="Unpublishing…">
                Unpublish ({manual ? "back to draft" : "back to review"})
              </SubmitButton>
            </form>
          )}
          {n.status !== "archived" && (
            <form action={contentStatusAction}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitButton name="action" value="archive" className="btn-secondary" pendingLabel="Archiving…" label="Archive" />
            </form>
          )}
          <form action={deleteContentAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={n.id} />
            <input name="confirm" placeholder="Type DELETE" className="input w-32" aria-label="Type DELETE to confirm deletion" autoComplete="off" />
            <SubmitButton className="btn-secondary text-danger" pendingLabel="Deleting…" label="Delete permanently" />
          </form>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="card mb-4 border-urgent p-4">
          <h2 className="text-lg font-bold">Pipeline suggestions</h2>
          <p className="text-sm text-muted">The official source now shows values that differ from your edits. They were not applied.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {suggestions.map((r) => (
              <li key={r.id}>
                <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>{" "}
                {Object.entries(r.diff)
                  .filter(([k]) => k !== "source")
                  .map(([k, [a, b]]) => `${k}: yours ${String(a ?? "—")} · source ${String(b ?? "—")}`)
                  .join("; ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ContentEditor n={n as unknown as EditorNotice} defaultKind={n.kind} sections={sections} opts={opts} qualIds={data.qualIds} attachment={attachment} />

      <section className="card mt-6 p-4">
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
                  {k}: {JSON.stringify(a ?? "—").slice(0, 80)} → {JSON.stringify(b ?? "—").slice(0, 80)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
