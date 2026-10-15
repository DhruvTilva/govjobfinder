import Link from "next/link";
import { failedDiscoveries, listRuns } from "@/lib/admin-queries";
import { formatDateTime, timeAgo } from "@/lib/status";
import { Notice, PageTitle, Pill, Table } from "@/components/admin/ui";
import { reprocessReviewQueue, requestFullRun, retryDiscoveries } from "../../actions";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [runs, failed] = await Promise.all([listRuns(), failedDiscoveries()]);
  const dispatchConfigured = Boolean(process.env.GITHUB_DISPATCH_TOKEN && process.env.GITHUB_REPOSITORY);
  return (
    <>
      <PageTitle title="Pipeline">
        <form action={reprocessReviewQueue}>
          <button className="btn-secondary" title="Re-extract unedited auto-collected items in review/archived with the current rules">
            Re-run extraction on review queue
          </button>
        </form>
        <form action={requestFullRun}>
          <button className="btn-primary">Run full pipeline</button>
        </form>
      </PageTitle>
      {sp.reprocessed && <Notice tone="ok">{sp.reprocessed} item(s) re-queued; they will be processed on the next run.</Notice>}
      {sp.requested === "dispatched" && <Notice tone="ok">GitHub workflow dispatched. The run appears here once the worker starts (usually under a minute).</Notice>}
      {sp.requested === "queued" && (
        <Notice tone="info">
          Request queued. {dispatchConfigured ? "Dispatching the GitHub workflow failed; " : ""}The next scheduled worker run will scan all enabled sources.
        </Notice>
      )}
      {sp.retried && <Notice tone="ok">Failed items will be retried on the next run.</Notice>}
      <p className="mb-4 text-sm text-muted">
        Scheduled runs are executed by the worker (GitHub Actions — see docs/OPERATIONS.md). Use “Scan now” on a source page for an immediate single-source scan.
      </p>

      <h2 className="mb-2 text-lg font-bold">Run history</h2>
      <Table head={["Run", "Trigger", "Status", "Started", "Duration", "Stats"]}>
        {runs.map(({ r, sourceName }) => (
          <tr key={r.id} className="align-top">
            <td className="px-3 py-2">
              <Link href={`/admin/pipeline/${r.id}`} className="text-navy-700 hover:underline">
                #{r.id}
              </Link>
            </td>
            <td className="px-3 py-2">
              {r.trigger}
              {sourceName && <span className="block text-xs text-muted">{sourceName}</span>}
            </td>
            <td className="px-3 py-2">
              <Pill value={r.status} />
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-muted" title={formatDateTime(r.startedAt)}>
              {timeAgo(r.startedAt)}
            </td>
            <td className="px-3 py-2 text-muted">{r.finishedAt ? `${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)} s` : "running"}</td>
            <td className="px-3 py-2 text-xs text-muted">
              {Object.entries(r.stats)
                .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
                .join(" · ") || r.error}
            </td>
          </tr>
        ))}
      </Table>

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">Failed items waiting for retry ({failed.length})</h2>
        {failed.length > 0 && (
          <form action={retryDiscoveries}>
            <button className="btn-secondary">Retry all on next run</button>
          </form>
        )}
      </div>
      <Table head={["Link", "Source", "Attempts", "Next attempt", "Error", ""]}>
        {failed.map(({ d, sourceName }) => (
          <tr key={d.id} className="align-top">
            <td className="max-w-sm px-3 py-2">{d.linkText.slice(0, 120)}</td>
            <td className="px-3 py-2 text-xs">{sourceName}</td>
            <td className="px-3 py-2">{d.attempts}</td>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{d.nextAttemptAt ? formatDateTime(d.nextAttemptAt) : "—"}</td>
            <td className="px-3 py-2 text-xs text-danger">{d.lastError}</td>
            <td className="px-3 py-2">
              <form action={retryDiscoveries}>
                <input type="hidden" name="id" value={d.id} />
                <button className="text-xs font-semibold text-navy-700 underline">Retry</button>
              </form>
            </td>
          </tr>
        ))}
        {!failed.length && (
          <tr>
            <td colSpan={6} className="px-3 py-4 text-muted">
              Nothing is failing.
            </td>
          </tr>
        )}
      </Table>
    </>
  );
}
