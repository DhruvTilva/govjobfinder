import Link from "next/link";
import {
  activeCounts,
  freshness,
  getFilterOptions,
  listNotices,
  listStates,
  recentUpdateCounts,
  stateRecruiterNames,
  topRecruiters,
  type Filters,
  type NoticeCard,
} from "@/lib/queries";
import { noticeHref } from "@/lib/status";
import { todayIST } from "@/pipeline/dates";
import { getI18n } from "@/lib/i18n-server";
import { formatDateL, qualName, sectorName, stateName, timeAgoL, type Lang, type MessageKey, type T } from "@/lib/i18n";
import { JobRow, qualList } from "@/components/NoticeCard";
import { AlertsCard } from "@/components/AlertsCard";
import { ChevronRight,DocIcon, PinIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, siteUrl } from "@/lib/site";

/** Plain search shortcuts — no counts are claimed. [label en, label hi, query] */
const POPULAR: [string, string, string][] = [
  ["SSC", "SSC", "SSC"],
  ["Railway", "रेलवे", "Railway"],
  ["Police constable", "पुलिस कांस्टेबल", "Police constable"],
  ["Teacher", "शिक्षक", "Teacher"],
  ["Staff nurse", "स्टाफ नर्स", "Staff nurse"],
  ["Junior engineer", "जूनियर इंजीनियर", "Junior engineer"],
  ["Bank", "बैंक", "Bank"],
  ["Apprentice", "अप्रेंटिस", "Apprentice"],
  ["Clerk", "क्लर्क", "Clerk"],
  ["Scientist", "वैज्ञानिक", "Scientist"],
];

/** Feed tabs: each is a real filter on published recruitments. */
const FEED_TABS: { key: string; label: MessageKey; filters: Filters; more: string }[] = [
  { key: "all", label: "feed.all", filters: {}, more: "/jobs" },
  { key: "closing", label: "feed.closing", filters: { status: "closing", sort: "closing" }, more: "/jobs?status=closing&sort=closing" },
  { key: "central", label: "feed.central", filters: { state: "central" }, more: "/jobs?state=central" },
  { key: "state", label: "feed.state", filters: { scope: "state" }, more: "/states" },
  { key: "walkin", label: "feed.walkin", filters: { jobType: "contract" }, more: "/jobs?type=contract" },
];

/** Qualification & sector shortcut tiles. */
const QS_TILES: { href: string; title: MessageKey; ex: MessageKey }[] = [
  { href: "/qualifications/10th-pass", title: "qs.10th", ex: "qs.10thEx" },
  { href: "/qualifications/12th-pass", title: "qs.12th", ex: "qs.12thEx" },
  { href: "/qualifications/graduate", title: "qs.grad", ex: "qs.gradEx" },
  { href: "/sectors/engineering", title: "qs.engg", ex: "qs.enggEx" },
  { href: "/sectors/medical", title: "qs.med", ex: "qs.medEx" },
  { href: "/sectors/teaching", title: "qs.teach", ex: "qs.teachEx" },
  { href: "/sectors/judiciary", title: "qs.law", ex: "qs.lawEx" },
  { href: "/sectors/police-paramilitary", title: "qs.police", ex: "qs.policeEx" },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const { t, lang } = await getI18n();
  const sp = await searchParams;
  const tab = FEED_TABS.find((x) => x.key === sp.feed) ?? FEED_TABS[0];
  const today = todayIST();
  const [boardJobs, admit, results, feed, counts, fresh, opts, stateRows, recruiters, stateNames, recent] = await Promise.all([
    listNotices({}, "recruitment", 6),
    listNotices({ kind: "admit_card" }, "admit_card", 6),
    listNotices({ kind: "result" }, "result", 6),
    listNotices(tab.filters, "recruitment", 10),
    activeCounts(),
    freshness(),
    getFilterOptions(),
    listStates(),
    topRecruiters(7),
    stateRecruiterNames(),
    recentUpdateCounts(),
  ]);

  const localOpts = {
    states: opts.states.map((s) => ({ slug: s.slug, name: stateName(lang, s.slug, s.name) })),
    sectors: opts.sectors.map((s) => ({ slug: s.slug, name: sectorName(lang, s.slug, s.name) })),
    qualifications: opts.qualifications.map((q) => ({ slug: q.slug, name: qualName(lang, q.slug, q.name) })),
  };
  const checked = fresh.lastRunAt ? timeAgoL(fresh.lastRunAt, lang) : t("home.notYet");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: siteUrl(),
          potentialAction: { "@type": "SearchAction", target: `${siteUrl("/jobs")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
        }}
      />

      {/* Freshness strip */}
      <div className="border-b border-line bg-navy-50">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-body">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
            {t("home.checked")} <strong className="text-ink">{checked}</strong>
          </span>
          {counts.closingThisWeek > 0 && (
            <Link href="/jobs?status=closing&sort=closing" className="flex items-center font-bold text-accent hover:underline">
              {t("home.closingLink", { n: counts.closingThisWeek })} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Hero + search (unchanged) */}
      <section className="border-b border-line bg-white">
        <div className="container-page py-8 sm:py-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-700">
                {t("home.eyebrow")}
              </p>
              <h1 className="mt-1 text-3xl sm:text-4xl">{t("home.title")}</h1>
              <p className="mt-2 text-[15px] text-muted">{t("home.subtitle")}</p>
            </div>
            <dl className="flex gap-2 self-start rounded-xl bg-navy-50 p-2 lg:self-auto">
              <HeroStat value={counts.total} label={t("home.statActive")} />
              <HeroStat value={counts.closingThisWeek} label={t("home.statClosing")} tone="text-accent" />
              <HeroStat value={fresh.sourcesMonitored} label={t("home.statSites")} tone="text-ok" />
            </dl>
          </div>

          <form action="/jobs" className="mt-6 grid gap-2 rounded-xl bg-navy-50 p-3 sm:grid-cols-12" role="search">
            <div className="relative sm:col-span-4">
              <label htmlFor="h-q" className="sr-only">
                {t("list.keyword")}
              </label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input id="h-q" name="q" placeholder={t("home.keyword")} className="input py-3 pl-9" />
            </div>
            <HeroSelect id="h-state" name="state" label={t("list.state")} className="sm:col-span-3">
              <option value="">{t("home.allStates")}</option>
              <option value="central">{t("common.centralGovt")}</option>
              {localOpts.states.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </HeroSelect>
            <HeroSelect id="h-sector" name="sector" label={t("list.sector")} className="sm:col-span-2">
              <option value="">{t("home.allSectors")}</option>
              {localOpts.sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </HeroSelect>
            <HeroSelect id="h-qual" name="qual" label={t("list.qual")} className="sm:col-span-2">
              <option value="">{t("home.anyQual")}</option>
              {localOpts.qualifications.map((q) => (
                <option key={q.slug} value={q.slug}>
                  {q.name}
                </option>
              ))}
            </HeroSelect>
            <button type="submit" className="btn-primary py-3 sm:col-span-1">
              <span className="sm:sr-only xl:not-sr-only">{t("home.search")}</span>
            </button>
          </form>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-sm scrollbar-none">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-muted">{t("home.popular")}</span>
            {POPULAR.map(([en, hi, q]) => (
              <Link key={q} href={`/jobs?q=${encodeURIComponent(q)}`} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-body hover:border-navy-950 hover:bg-navy-950 hover:text-white">
                {lang === "hi" ? hi : en}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container-page space-y-6 py-6">
        {/* 1. Three fast-update boards */}
        <section aria-labelledby="boards" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="boards" className="panel-title text-sm">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-brand" /> {t("board.title")}
            </h2>
            <span className="font-mono text-xs text-muted">{t("board.checked", { t: checked })}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Board
              title={t("board.jobs")}
              icon={<SearchIcon className="h-4 w-4" />}
              badge={t("common.active", { n: counts.total })}
              tone="brand"
              href="/jobs"
              footer={t("board.viewJobs", { n: counts.total.toLocaleString("en-IN") })}
              empty={t("common.none")}
              items={boardJobs.items.map((n) => ({
                href: noticeHref(n),
                title: n.title,
                tag: n.totalPosts != null ? t("common.posts", { n: n.totalPosts.toLocaleString("en-IN") }) : (n.orgShort ?? null),
                meta: [qualList(n.quals, lang), n.applyEnd ? t("board.lastDate", { date: formatDateL(n.applyEnd, lang) }) : t("board.notStatedDate")].filter(Boolean).join(" · "),
              }))}
            />
            <Board
              title={t("board.admit")}
              icon={<DocIcon className="h-4 w-4" />}
              badge={t("common.thisWeek", { n: recent.admit_card ?? 0 })}
              tone="slate"
              href="/admit-cards"
              footer={t("board.viewAdmit")}
              empty={t("common.none")}
              items={admit.items.map((n) => updateItem(n, lang))}
            />
            <Board
              title={t("board.results")}
              icon={<ShieldIcon className="h-4 w-4" />}
              badge={t("common.thisWeek", { n: recent.result ?? 0 })}
              tone="green"
              href="/results"
              footer={t("board.viewResults")}
              empty={t("common.none")}
              items={results.items.map((n) => updateItem(n, lang))}
            />
          </div>
        </section>

        {/* 2. State-wise directory */}
        <section aria-labelledby="state-grid" className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <h2 id="state-grid" className="panel-title">
              {/* <PinIcon className="h-4 w-4 text-saffron" />  */}
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-brand" />
              {t("states.title")}
            </h2>
            <Link href="/states" className="text-xs font-bold text-brand hover:underline">
              {t("states.all")}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <StateTile href="/jobs?state=central" name={t("common.centralGovt")} bodies="UPSC / SSC / RRB" n={counts.central} t={t} />
            {stateRows.map((s) => (
              <StateTile
                key={s.id}
                href={`/states/${s.slug}`}
                name={stateName(lang, s.slug, s.name)}
                bodies={(stateNames.get(s.id) ?? []).join(" / ") || (s.type === "ut" ? t("home.utAdmin") : t("home.statePortal"))}
                n={counts.byState.get(s.id) ?? 0}
                t={t}
              />
            ))}
          </ul>
        </section>

        {/* 3. Feed + utility sidebar */}
        <div id="latest-jobs" className="grid scroll-mt-40 grid-cols-1 gap-5 lg:grid-cols-12">
          <section aria-labelledby="feed" className="min-w-0 space-y-3 lg:col-span-8 xl:col-span-9">
            <div className="card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="feed" className="text-sm font-bold uppercase tracking-wide">
                    {t("feed.title")}
                  </h2>
                  <p className="text-[11px] text-muted">{t("feed.sub")}</p>
                </div>
                <nav aria-label={t("list.filters")} className="-mx-1 overflow-x-auto px-1 scrollbar-none">
                  <ul className="flex w-max items-center gap-1 rounded border border-line bg-slate-100 p-0.5 text-[11px]">
                    {FEED_TABS.map((x) => {
                      const active = x.key === tab.key;
                      return (
                        <li key={x.key}>
                          <Link
                            href={x.key === "all" ? "/#latest-jobs" : `/?feed=${x.key}#latest-jobs`}
                            scroll={false}
                            aria-current={active ? "true" : undefined}
                            className={`block whitespace-nowrap rounded px-2.5 py-1 font-semibold transition-colors ${active ? "bg-brand text-white" : "text-slate-700 hover:bg-white"}`}
                          >
                            {t(x.label)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </div>

            {feed.items.length ? (
              <div className="space-y-2.5">
                {feed.items.map((n) => (
                  <JobRow key={n.id} n={n} today={today} badge={false} />
                ))}
              </div>
            ) : (
              <p className="card p-8 text-center text-muted">{t("feed.empty")}</p>
            )}

            <div className="card flex flex-col items-center justify-between gap-2 p-3 text-xs sm:flex-row">
              <span className="text-muted">{t("feed.showing", { a: feed.items.length, b: feed.total.toLocaleString("en-IN") })}</span>
              <Link href={tab.more} className="btn-brand px-3 py-1.5 text-xs">
                {t("feed.viewAll")}
              </Link>
            </div>
          </section>

          <aside className="min-w-0 space-y-4 lg:col-span-4 xl:col-span-3">
            <AlertsCard states={localOpts.states} sectors={localOpts.sectors} qualifications={localOpts.qualifications} siteUrl={siteUrl()} />

            <section className="card p-3.5" aria-labelledby="toolbox">
              <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                <h2 id="toolbox" className="panel-title">
                  {t("side.toolbox")}
                </h2>
                <span className="tag bg-ok-soft text-ok">{t("side.free")}</span>
              </div>
              <ul className="space-y-2 text-xs">
                <Tool href="/tools/eligibility" title={t("home.tool.age")} text={t("home.tool.ageText")} />
                <Tool href="/qualifications" title={t("side.tool.quals")} text={t("side.tool.qualsText")} />
                <Tool href="/saved" title={t("home.tool.saved")} text={t("home.tool.savedText")} />
                <Tool href="/exams" title={t("home.tool.exams")} text={t("home.tool.examsText")} />
              </ul>
            </section>

            <section className="card p-3.5" aria-labelledby="commissions">
              <div className="mb-1 border-b border-line pb-2">
                <h2 id="commissions" className="panel-title">
                  {t("side.commissions")}
                </h2>
              </div>
              {recruiters.length ? (
                <ul className="divide-y divide-slate-100 text-xs">
                  {recruiters.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/organizations/${r.slug}`} className="flex items-center gap-2 py-1.5 hover:text-brand">
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{r.name}</span>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-ok">{t("common.active", { n: r.n })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-xs text-muted">{t("home.noRecruiters")}</p>
              )}
              <div className="mt-2 border-t border-slate-100 pt-2 text-center">
                <Link href="/sectors" className="text-xs font-bold text-brand hover:underline">
                  {t("side.allRecruiters")}
                </Link>
              </div>
            </section>
          </aside>
        </div>

        {/* 4. Qualification & sector tiles */}
        <section aria-labelledby="qs" className="card p-4">
          <div className="mb-3 border-b border-line pb-3">
            <h2 id="qs" className="panel-title">
              {t("qs.title")}
            </h2>
            <p className="text-[11px] text-muted">{t("qs.sub")}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
            {QS_TILES.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="block h-full rounded border border-line p-2.5 transition-colors hover:border-brand hover:bg-slate-50">
                  <span className="block font-bold text-ink">{t(q.title)}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{t(q.ex)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function updateItem(n: NoticeCard, lang: Lang) {
  return {
    href: noticeHref(n),
    title: n.title,
    tag: n.orgShort ?? null,
    meta: [n.orgName, formatDateL((n.publishedAt ?? n.firstSeenAt).toISOString(), lang)].filter(Boolean).join(" · "),
  };
}

const BOARD_TONE = {
  brand: { frame: "border-brand", head: "bg-brand", title: "text-brand", hover: "hover:bg-blue-50/60" },
  slate: { frame: "border-slate-700", head: "bg-slate-800", title: "text-ink", hover: "hover:bg-slate-50" },
  green: { frame: "border-gov-green", head: "bg-gov-green", title: "text-gov-green", hover: "hover:bg-emerald-50/60" },
} as const;

function Board({
  title,
  icon,
  badge,
  tone,
  href,
  footer,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  badge: string;
  tone: keyof typeof BOARD_TONE;
  href: string;
  footer: string;
  items: { href: string; title: string; tag: string | null; meta: string }[];
  empty: string;
}) {
  const c = BOARD_TONE[tone];
  return (
    <div className={`flex flex-col overflow-hidden rounded-md border-2 bg-white shadow-sm ${c.frame}`}>
      <div className={`flex items-center justify-between gap-2 px-3 py-2 text-white ${c.head}`}>
        <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white">
          <span className="truncate">{title}</span>
        </h3>
        <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-bold">{badge}</span>
      </div>
      {items.length ? (
        <ul className="flex-1 divide-y divide-slate-100 text-xs">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={`group block p-2.5 transition-colors ${c.hover}`}>
                <span className="mb-0.5 flex items-start justify-between gap-2">
                  <span className={`line-clamp-2 font-bold group-hover:underline ${c.title}`}>{it.title}</span>
                  {it.tag && <span className="tag max-w-28 shrink-0 truncate bg-slate-100 text-slate-700">{it.tag}</span>}
                </span>
                <span className="block truncate text-[11px] text-muted">{it.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 p-4 text-xs text-muted">{empty}</p>
      )}
      <div className="border-t border-line bg-slate-50 p-2 text-center">
        <Link href={href} className={`text-xs font-bold hover:underline ${c.title}`}>
          {footer}
        </Link>
      </div>
    </div>
  );
}

function StateTile({ href, name, bodies, n, t }: { href: string; name: string; bodies: string; n: number; t: T }) {
  return (
    <li>
      <Link href={href} className="flex h-full flex-col justify-between rounded border border-line p-2 transition-all hover:border-brand hover:bg-blue-50/40">
        <span className="truncate font-bold text-ink">{name}</span>
        <span className="mt-1 flex items-center justify-between gap-1 text-[11px]">
          <span className="min-w-0 truncate text-slate-500">{bodies}</span>
          {n > 0 ? (
            <span className="tag shrink-0 bg-emerald-50 text-ok">{t("common.active", { n })}</span>
          ) : (
            <span className="shrink-0 text-[10px] text-slate-400">—</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Tool({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-2 rounded border border-line p-2 transition-colors hover:border-brand hover:bg-slate-50">
        <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
        <span>
          <span className="block font-bold text-ink">{title}</span>
          <span className="block text-[11px] text-muted">{text}</span>
        </span>
      </Link>
    </li>
  );
}

function HeroStat({ value, label, tone = "text-navy-950" }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-1.5 text-center shadow-sm">
      <dd className={`text-xl font-bold ${tone}`}>{value.toLocaleString("en-IN")}</dd>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
    </div>
  );
}

function HeroSelect({ id, name, label, className, children }: { id: string; name: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} name={name} className="input py-3" defaultValue="">
        {children}
      </select>
    </div>
  );
}
