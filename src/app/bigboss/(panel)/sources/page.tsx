import Link from "next/link";
import { z } from "zod";
import { listSources } from "@/lib/admin-queries";
import { hostnameOf } from "@/lib/url";
import { timeAgo } from "@/lib/status";
import { CHECK_LABEL, CheckPill, PageTitle, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Sources" };

const HEALTH = ["failing", "broken", "never", "disabled", "ok"] as const;
const CHECKS = ["never", "checking", "new_notices", "no_new", "no_links", "partial", "failed"] as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = {
    q: z.string().max(100).optional().catch(undefined).parse(sp.q),
    health: z.enum(HEALTH).optional().catch(undefined).parse(sp.health),
    check: z.enum(CHECKS).optional().catch(undefined).parse(sp.check),
    page: z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page),
  };
  const { rows, total, page, pageCount } = await listSources(f);
  return (
    <>
      <PageTitle title="Sources">
        <Link href="/bigboss/sources/new" className="btn-primary">
          Add source
        </Link>
      </PageTitle>
      <form className="card mb-4 flex flex-wrap gap-2 p-3" action="/bigboss/sources">
        <input name="q" defaultValue={f.q} placeholder="Name, URL or organisation" className="input max-w-xs" aria-label="Search" />
        <select name="health" defaultValue={f.health ?? ""} className="input max-w-[200px]" aria-label="Health">
          <option value="">All sources</option>
          <option value="failing">Failing</option>
          <option value="broken">URL broken / timeout</option>
          <option value="never">Never succeeded</option>
          <option value="disabled">Disabled</option>
          <option value="ok">Healthy</option>
        </select>
        <select name="check" defaultValue={f.check ?? ""} className="input max-w-[200px]" aria-label="Last check">
          <option value="">Any last check</option>
          {CHECKS.map((c) => (
            <option key={c} value={c}>
              {CHECK_LABEL[c]}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filter</button>
        <span className="ml-auto self-center text-sm text-muted">{total} sources</span>
      </form>
      <Table head={["Source", "Organisation / state", "P", "Trust", "URL", "Last check", "Last success", "Fails", "Published"]}>
        {rows.map(({ s, orgName, stateName, published }) => (
          <tr key={s.id} className={s.enabled ? "" : "opacity-60"}>
            <td className="px-3 py-2">
              <Link href={`/bigboss/sources/${s.id}`} className="font-medium text-navy-700 hover:underline">
                {s.name}
              </Link>
              <span className="block text-xs text-muted">
                {hostnameOf(s.url)} {s.method === "manual" ? "· reference only" : ""} {!s.enabled ? "· disabled" : ""}
              </span>
            </td>
            <td className="px-3 py-2 text-xs">
              {orgName ?? "—"}
              <span className="block text-muted">{stateName ?? "Central"}</span>
            </td>
            <td className="px-3 py-2">{s.priority}</td>
            <td className="px-3 py-2 text-xs">{s.trust}</td>
            <td className="px-3 py-2">
              <Pill value={s.urlStatus} />
            </td>
            <td className="whitespace-nowrap px-3 py-2">
              <CheckPill value={s.enabled ? s.lastCheckStatus : "disabled"} />
              {s.lastCheckFound != null && <span className="block text-xs text-muted">{s.lastCheckFound} links · {s.lastCheckNew ?? 0} new</span>}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-muted">{timeAgo(s.lastSuccessAt)}</td>
            <td className={`px-3 py-2 font-semibold ${s.consecutiveFailures ? "text-danger" : "text-muted"}`}>{s.consecutiveFailures}</td>
            <td className="px-3 py-2">{published}</td>
          </tr>
        ))}
      </Table>
      {pageCount > 1 && (
        <div className="mt-4 flex gap-2 text-sm">
          {page > 1 && (
            <Link className="btn-secondary" href={`/bigboss/sources?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), ...(f.health ? { health: f.health } : {}), ...(f.check ? { check: f.check } : {}), page: String(page - 1) })}`}>
              Previous
            </Link>
          )}
          <span className="self-center text-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link className="btn-secondary" href={`/bigboss/sources?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), ...(f.health ? { health: f.health } : {}), ...(f.check ? { check: f.check } : {}), page: String(page + 1) })}`}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
