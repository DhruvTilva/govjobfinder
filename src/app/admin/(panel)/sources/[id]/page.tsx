import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceDetail, referenceOptions } from "@/lib/admin-queries";
import { formatDateTime, timeAgo } from "@/lib/status";
import { safeHref } from "@/lib/url";
import { SourceEditor } from "@/components/admin/SourceEditor";
import { SubmitButton } from "@/components/admin/ActionForm";
import { Notice, PageTitle, Pill, Table } from "@/components/admin/ui";
import { sourceAction } from "../../../actions";

export const metadata = { title: "Source" };
// "Scan now" runs a bounded single-source pipeline pass inside this request.
export const maxDuration = 60;

const DONE: Record<string, string> = {
  enabled: "Source enabled.",
  disabled: "Source disabled.",
  queued: "Scan queued for the next pipeline run.",
  reset: "Failure counter and cache reset; it will be scanned on the next run.",
};

export default async function SourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [data, opts] = await Promise.all([getSourceDetail(id), referenceOptions()]);
  if (!data) notFound();
  const { s } = data;
  const done = sp.done ?? "";
  const doneMsg = DONE[done] ?? (done.startsWith("url-") ? `URL check: ${done.slice(4)}` : done.startsWith("scanned-") ? `Scan finished (run #${done.slice(8)}). See events below.` : null);

  const act = (action: string, label: string, primary = false) => (
    <form action={sourceAction}>
      <input type="hidden" name="id" value={s.id} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton label={label} className={primary ? "btn-primary" : "btn-secondary"} />
    </form>
  );

  return (
    <>
      <PageTitle title={s.name}>
        {s.method !== "manual" && act("scan", "Scan now", true)}
        {act("queue", "Queue for next run")}
        {act("validate", "Check URL")}
        {act("reset", "Reset failures")}
        {act("toggle", s.enabled ? "Disable" : "Enable")}
      </PageTitle>
      {sp.saved && <Notice tone="ok">Source added.</Notice>}
      {doneMsg && <Notice tone="ok">{doneMsg}</Notice>}

      <div className="card mb-4 grid gap-3 p-4 text-sm sm:grid-cols-4">
        <Info label="URL status">
          <Pill value={s.urlStatus} /> {s.lastStatusCode ? `HTTP ${s.lastStatusCode}` : ""}
        </Info>
        <Info label="Last checked">{timeAgo(s.lastCheckedAt)}</Info>
        <Info label="Last success">{s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "never"}</Info>
        <Info label="Last new link">{s.lastDiscoveryAt ? formatDateTime(s.lastDiscoveryAt) : "never"}</Info>
        <Info label="Next scan">{s.nextCheckAt ? formatDateTime(s.nextCheckAt) : "on next run"}</Info>
        <Info label="Consecutive failures">{s.consecutiveFailures}</Info>
        <Info label="Organisation">{data.orgSlug ? <Link href={`/organizations/${data.orgSlug}`} className="text-navy-700 underline">{data.orgName}</Link> : "—"}</Info>
        <Info label="Final URL">
          <a href={safeHref(s.finalUrl ?? s.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-navy-700 underline">
            {s.finalUrl ?? s.url}
          </a>
        </Info>
        {s.lastError && (
          <p className="sm:col-span-4 rounded bg-danger-soft px-3 py-2 text-xs text-danger">
            <strong>Last error:</strong> {s.lastError}
          </p>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <SourceEditor s={s} orgs={opts.organizations} />
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-lg font-bold">Recent links found</h2>
            <Table head={["Link", "State", "Found"]}>
              {data.recent.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="px-3 py-2">
                    {d.noticeId ? (
                      <Link href={`/admin/notices/${d.noticeId}`} className="text-navy-700 hover:underline">
                        {d.linkText.slice(0, 120)}
                      </Link>
                    ) : (
                      <span>{d.linkText.slice(0, 120)}</span>
                    )}
                    {d.lastError && <span className="block text-xs text-danger">{d.lastError}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Pill value={d.state} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{timeAgo(d.firstSeenAt)}</td>
                </tr>
              ))}
              {!data.recent.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-muted">
                    Nothing harvested yet.
                  </td>
                </tr>
              )}
            </Table>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Pipeline events</h2>
            <Table head={["When", "Level", "Message"]}>
              {data.events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{timeAgo(e.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Pill value={e.level === "error" ? "failed" : e.level === "warn" ? "partial" : "ok"} />
                  </td>
                  <td className="px-3 py-2 text-xs">{e.message}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
