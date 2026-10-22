import Link from "next/link";
import { overviewStats, reviewReasonCounts } from "@/lib/admin-queries";
import { formatDateTime, timeAgo } from "@/lib/status";
import { CheckPill, PageTitle, Pill, StatCard, Table } from "@/components/admin/ui";
import { requestFullRun } from "../actions";

export const metadata = { title: "Overview" };

const CHECK_ORDER = ["new_notices", "no_new", "no_links", "partial", "failed", "checking", "never", "disabled"];

export default async function AdminHome() {
  const [s, reasons] = await Promise.all([overviewStats(), reviewReasonCounts()]);
  const health = Object.fromEntries(s.health.map((h) => [h.status, h.n]));
  const disc = Object.fromEntries(s.discoveryStates.map((d) => [d.state, d.n]));
  const checks: Record<string, number> = Object.fromEntries(s.checkStates.map((c) => [c.status, c.n]));
  return (
    <>
      <PageTitle title="Overview">
        <form action={requestFullRun}>
          <button className="btn-primary">Run pipeline now</button>
        </form>
      </PageTitle>
      <p className="mb-4 text-sm text-muted">
        All figures are live counts from the database. Last successful pipeline run: <strong className="text-ink">{s.lastSuccessAt ? `${timeAgo(s.lastSuccessAt)} (${formatDateTime(s.lastSuccessAt)})` : "never"}</strong>
        {s.pending > 0 && ` · ${s.pending} run request(s) waiting for the next worker`}.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active published jobs" value={s.activePublished} href="/bigboss/notices?status=published&kind=recruitment" tone="good" />
        <StatCard label="Awaiting review" value={s.needsReview} href="/bigboss/notices?status=needs_review" tone={s.needsReview ? "warn" : undefined} />
        <StatCard label="Links discovered (24h)" value={s.discovered24h} />
        <StatCard label="Published (24h)" value={s.published24h} />
        <StatCard label="Closing in 7 days" value={s.closingSoon} />
        <StatCard label="Closed" value={s.closed} href="/bigboss/notices?status=closed" />
        <StatCard label="Cancelled / withdrawn" value={s.cancelled} />
        <StatCard label="Sources failing (3+)" value={s.failing.length} href="/bigboss/sources?health=failing" tone={s.failing.length ? "bad" : "good"} />
        <StatCard label="Configured sources" value={s.totalSources} href="/bigboss/sources" />
        <StatCard label="Sources never checked" value={checks.never ?? 0} href="/bigboss/sources?health=never" tone={checks.never ? "warn" : undefined} />
        <StatCard label="Duplicates prevented" value={s.duplicatesPrevented} />
        <StatCard label="Amendments applied" value={s.amendmentsApplied} />
      </div>
      <p className="mt-3 text-sm text-muted">
        Last successful source check: <strong className="text-ink">{s.lastSourceSuccessAt ? `${timeAgo(s.lastSourceSuccessAt)} (${formatDateTime(s.lastSourceSuccessAt)})` : "never"}</strong>
        {" · "}Last new link discovered: <strong className="text-ink">{s.lastDiscoveryAt ? timeAgo(s.lastDiscoveryAt) : "never"}</strong>
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-lg font-bold">Recent pipeline runs</h2>
          <Table head={["Run", "Trigger", "Status", "Started", "Result"]}>
            {s.runs.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link href={`/bigboss/pipeline/${r.id}`} className="text-navy-700 hover:underline">
                    #{r.id}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.trigger}</td>
                <td className="px-3 py-2">
                  <Pill value={r.status} />
                </td>
                <td className="px-3 py-2 text-muted">{timeAgo(r.startedAt)}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {["sourcesScanned", "newDiscoveries", "published", "needs_review", "sourceErrors"]
                    .filter((k) => r.stats[k])
                    .map((k) => `${k.replace(/_/g, " ")}: ${r.stats[k]}`)
                    .join(" · ") || r.error || "—"}
                </td>
              </tr>
            ))}
            {!s.runs.length && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted">
                  No runs yet.
                </td>
              </tr>
            )}
          </Table>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Why items are waiting for review</h2>
          <Table head={["Reason", "Notices"]}>
            {reasons.map((r) => (
              <tr key={r.reason}>
                <td className="px-3 py-2">
                  <Link href={`/bigboss/notices?status=needs_review&reason=${encodeURIComponent(r.reason)}`} className="text-navy-700 hover:underline">
                    {r.reason}
                  </Link>
                </td>
                <td className="px-3 py-2 font-semibold">{r.n}</td>
              </tr>
            ))}
            {!reasons.length && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-muted">
                  Review queue is empty.
                </td>
              </tr>
            )}
          </Table>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Source checks (last outcome)</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {CHECK_ORDER.filter((k) => checks[k]).map((k) => (
              <Link key={k} href={`/bigboss/sources?check=${k}`} className="card flex items-center gap-2 px-3 py-2 hover:bg-navy-50">
                <CheckPill value={k} /> {checks[k]}
              </Link>
            ))}
          </div>
          <h3 className="mb-2 mt-4 font-sans text-sm font-bold uppercase tracking-wide text-muted">Listing URL status (enabled sources)</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(health).map(([k, n]) => (
              <span key={k} className="card flex items-center gap-2 px-3 py-2">
                <Pill value={k} /> {n}
              </span>
            ))}
          </div>
          <h3 className="mb-2 mt-4 font-sans text-sm font-bold uppercase tracking-wide text-muted">Discovered links by state</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(disc).map(([k, n]) => (
              <span key={k} className="card flex items-center gap-2 px-3 py-2">
                <Pill value={k} /> {n}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Sources needing attention</h2>
          <Table head={["Source", "Failures", "Last error", "Last success"]}>
            {s.failing.map((f) => (
              <tr key={f.id}>
                <td className="px-3 py-2">
                  <Link href={`/bigboss/sources/${f.id}`} className="text-navy-700 hover:underline">
                    {f.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-semibold text-danger">{f.failures}</td>
                <td className="max-w-xs truncate px-3 py-2 text-xs text-muted" title={f.lastError ?? ""}>
                  {f.lastError}
                </td>
                <td className="px-3 py-2 text-muted">{timeAgo(f.lastSuccessAt)}</td>
              </tr>
            ))}
            {!s.failing.length && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted">
                  No source has failed three times in a row.
                </td>
              </tr>
            )}
          </Table>
        </section>
      </div>
    </>
  );
}
