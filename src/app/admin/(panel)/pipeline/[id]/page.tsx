import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/status";
import { PageTitle, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Pipeline run" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getRun(Number((await params).id));
  if (!data) notFound();
  const { run, events } = data;
  return (
    <>
      <PageTitle title={`Run #${run.id}`} />
      <div className="card mb-4 flex flex-wrap gap-4 p-4 text-sm">
        <Pill value={run.status} />
        <span>Trigger: {run.trigger}</span>
        <span>Started {formatDateTime(run.startedAt)}</span>
        {run.finishedAt && <span>Finished {formatDateTime(run.finishedAt)}</span>}
        {run.error && <span className="text-danger">{run.error}</span>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {Object.entries(run.stats).map(([k, v]) => (
          <span key={k} className="card px-3 py-1.5">
            {k.replace(/_/g, " ")}: <strong>{v}</strong>
          </span>
        ))}
      </div>
      <Table head={["Time", "Level", "Source", "Message"]}>
        {events.map(({ e, sourceName }) => (
          <tr key={e.id} className="align-top">
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDateTime(e.createdAt)}</td>
            <td className="px-3 py-2">
              <Pill value={e.level === "error" ? "failed" : e.level === "warn" ? "partial" : "ok"} />
            </td>
            <td className="px-3 py-2 text-xs">
              {e.sourceId ? (
                <Link href={`/admin/sources/${e.sourceId}`} className="text-navy-700 hover:underline">
                  {sourceName}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className="px-3 py-2 text-xs">{e.message}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
