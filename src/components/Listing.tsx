import Link from "next/link";
import { filtersToSearch, getFilterOptions, listNotices, type Filters } from "@/lib/queries";
import type { NoticeKind } from "@/db/schema";
import { todayIST } from "@/pipeline/dates";
import { getI18n } from "@/lib/i18n-server";
import { qualName, sectorName, stateName, type MessageKey } from "@/lib/i18n";
import { NoticeGrid } from "./NoticeCard";
import { Pagination } from "./Nav";

type Fixed = Partial<Pick<Filters, "state" | "sector" | "org" | "qual">>;

const STATUS_OPTIONS: [string, MessageKey][] = [
  ["", "list.s.active"],
  ["open", "list.s.open"],
  ["closing", "list.s.closing"],
  ["upcoming", "list.s.upcoming"],
  ["closed", "list.s.closed"],
  ["all", "list.s.all"],
];
const SORT_OPTIONS: [string, MessageKey][] = [
  ["", "list.sort.latest"],
  ["closing", "list.sort.closing"],
  ["posts", "list.sort.posts"],
];
const TYPE_OPTIONS: [string, MessageKey][] = [
  ["", "list.t.any"],
  ["permanent", "list.t.permanent"],
  ["contract", "list.t.contract"],
  ["apprentice", "list.t.apprentice"],
  ["deputation", "list.t.deputation"],
];
const POSTED_OPTIONS: [string, MessageKey][] = [
  ["", "list.p.any"],
  ["1", "list.p.1"],
  ["7", "list.p.7"],
  ["30", "list.p.30"],
];

/**
 * Search + filters + results. `fixed` filters come from the page (e.g. the state
 * on a state page) and are not shown as editable controls.
 */
export async function Listing({
  filters,
  basePath,
  kind = "recruitment",
  kinds,
  fixed = {},
  showStatus = true,
}: {
  filters: Filters;
  basePath: string;
  kind?: NoticeKind;
  /** Show several notice kinds together (e.g. exam schedules + syllabus). */
  kinds?: NoticeKind[];
  fixed?: Fixed;
  showStatus?: boolean;
}) {
  const { t, lang } = await getI18n();
  const f: Filters = { ...filters, ...fixed };
  const [{ items, total, page, pageCount }, opts] = await Promise.all([listNotices(kinds ? { ...f, kinds } : { ...f, kind }, kind), getFilterOptions()]);
  const today = todayIST();
  const editable = { ...filters };
  for (const k of Object.keys(fixed) as (keyof Fixed)[]) delete editable[k];
  const hrefFor = (p: number) => basePath + filtersToSearch(editable, { page: p });
  const hasFilters = Object.entries(editable).some(([k, v]) => v !== undefined && k !== "page" && k !== "sort");
  const opt = (list: [string, MessageKey][]) => list.map(([v, k]) => [v, t(k)] as [string, string]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="min-w-0">
        <details open className="card group p-4 lg:sticky lg:top-40">
          <summary className="cursor-pointer list-none font-semibold text-ink lg:pointer-events-none">
            {t("list.filters")} <span className="text-xs font-normal text-muted lg:hidden">{t("list.tap")}</span>
          </summary>
          <form action={basePath} className="mt-3 space-y-3">
            <div>
              <label htmlFor="f-q" className="label">
                {t("list.keyword")}
              </label>
              <input id="f-q" name="q" defaultValue={f.q} className="input" placeholder={t("list.keywordPh")} />
            </div>
            {!fixed.state && (
              <Select id="f-state" name="state" label={t("list.state")} value={f.state}>
                <option value="">{t("common.allIndia")}</option>
                <option value="central">{t("common.centralGovt")}</option>
                <optgroup label={t("list.states")}>
                  {opts.states
                    .filter((s) => s.type === "state")
                    .map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {stateName(lang, s.slug, s.name)}
                      </option>
                    ))}
                </optgroup>
                <optgroup label={t("list.uts")}>
                  {opts.states
                    .filter((s) => s.type === "ut")
                    .map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {stateName(lang, s.slug, s.name)}
                      </option>
                    ))}
                </optgroup>
              </Select>
            )}
            {!fixed.sector && (
              <Select id="f-sector" name="sector" label={t("list.sector")} value={f.sector}>
                <option value="">{t("home.allSectors")}</option>
                {opts.sectors.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {sectorName(lang, s.slug, s.name)}
                  </option>
                ))}
              </Select>
            )}
            {!fixed.qual && kind === "recruitment" && !kinds && (
              <Select id="f-qual" name="qual" label={t("list.qual")} value={f.qual}>
                <option value="">{t("home.anyQual")}</option>
                {opts.qualifications.map((q) => (
                  <option key={q.slug} value={q.slug}>
                    {qualName(lang, q.slug, q.name)}
                  </option>
                ))}
              </Select>
            )}
            {kind === "recruitment" && !kinds && (
              <>
                {showStatus && <SimpleSelect id="f-status" name="status" label={t("list.status")} value={f.status} options={opt(STATUS_OPTIONS)} />}
                <SimpleSelect id="f-type" name="type" label={t("list.type")} value={f.jobType} options={opt(TYPE_OPTIONS)} />
              </>
            )}
            <SimpleSelect id="f-posted" name="posted" label={t("list.posted")} value={f.posted ? String(f.posted) : undefined} options={opt(POSTED_OPTIONS)} />
            {kind === "recruitment" && !kinds && <SimpleSelect id="f-sort" name="sort" label={t("list.sort")} value={f.sort} options={opt(SORT_OPTIONS)} />}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary flex-1">
                {t("list.apply")}
              </button>
              {hasFilters && (
                <Link href={basePath} className="btn-secondary">
                  {t("list.reset")}
                </Link>
              )}
            </div>
          </form>
        </details>
      </aside>
      <section aria-live="polite" className="min-w-0">
        <p className="mb-3 text-sm text-muted">
          {total === 0 ? t("list.noResults") : t("list.results", { n: total.toLocaleString("en-IN") })}
          {f.q && (
            <>
              {" "}
              {t("list.for")} <strong className="text-ink">“{f.q}”</strong>
            </>
          )}
          {pageCount > 1 && ` · ${t("list.page", { p: page, c: pageCount })}`}
        </p>
        <NoticeGrid
          items={items}
          today={today}
          empty={
            <>
              <p className="font-semibold text-ink">{t("list.emptyTitle")}</p>
              <p className="mt-1 text-sm">
                {t("list.emptyHint")}{" "}
                {hasFilters && (
                  <Link href={basePath} className="text-navy-700 underline">
                    {t("list.clear")}
                  </Link>
                )}
              </p>
            </>
          }
        />
        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </section>
    </div>
  );
}

function Select({ id, name, label, value, children }: { id: string; name: string; label: string; value?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className="input">
        {children}
      </select>
    </div>
  );
}

function SimpleSelect({ options, ...p }: { id: string; name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <Select {...p}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );
}
