import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  exams,
  noticeQualifications,
  noticeRevisions,
  notices,
  NOTICE_KINDS,
  organizations,
  qualifications,
  sectors,
  sources,
  states,
  uploads,
  type NoticeKind,
} from "@/db/schema";
import { addDays, todayIST } from "@/pipeline/dates";

export const PUBLIC_STATUSES = ["published", "closed", "cancelled", "withdrawn"] as const;
export const PAGE_SIZE = 20;

const STATUS_FILTERS = ["active", "open", "closing", "upcoming", "closed", "all"] as const;
const SORTS = ["latest", "closing", "posts"] as const;
const JOB_TYPES = ["permanent", "contract", "apprentice", "deputation"] as const;

export type Filters = {
  q?: string;
  state?: string;
  sector?: string;
  org?: string;
  qual?: string;
  jobType?: (typeof JOB_TYPES)[number];
  status?: (typeof STATUS_FILTERS)[number];
  kind?: NoticeKind;
  /** Restrict to several kinds (takes precedence over the default kind). */
  kinds?: NoticeKind[];
  /** "state" = state/UT recruitments only (excludes central). */
  scope?: "state";
  sort?: (typeof SORTS)[number];
  posted?: 1 | 7 | 30;
  page?: number;
};

const slugLike = z.string().regex(/^[a-z0-9-]{1,80}$/);

/** Parses filters from URL search params; invalid values are dropped rather than rejected. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const pick = <T,>(schema: z.ZodType<T>, v: unknown) => {
    const r = schema.safeParse(v);
    return r.success ? r.data : undefined;
  };
  return {
    q: pick(z.string().max(100), one("q")),
    state: pick(slugLike, one("state")),
    sector: pick(slugLike, one("sector")),
    org: pick(slugLike, one("org")),
    qual: pick(slugLike, one("qual")),
    jobType: pick(z.enum(JOB_TYPES), one("type")),
    status: pick(z.enum(STATUS_FILTERS), one("status")),
    kind: pick(z.enum(NOTICE_KINDS), one("kind")),
    sort: pick(z.enum(SORTS), one("sort")),
    posted: pick(z.coerce.number().pipe(z.union([z.literal(1), z.literal(7), z.literal(30)])), one("posted")),
    page: pick(z.coerce.number().int().min(1).max(500), one("page")),
  };
}

export function filtersToSearch(f: Filters, overrides: Partial<Record<keyof Filters, string | number | undefined>> = {}): string {
  const map: Record<string, string | number | undefined> = {
    q: f.q,
    state: f.state,
    sector: f.sector,
    org: f.org,
    qual: f.qual,
    type: f.jobType,
    status: f.status,
    sort: f.sort,
    posted: f.posted,
    page: f.page,
  };
  for (const [k, v] of Object.entries(overrides)) map[k === "jobType" ? "type" : k] = v;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(map)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

export const cardFields = {
  id: notices.id,
  slug: notices.slug,
  kind: notices.kind,
  status: notices.status,
  title: notices.title,
  advtNo: notices.advtNo,
  totalPosts: notices.totalPosts,
  ageMin: notices.ageMin,
  ageMax: notices.ageMax,
  applyStart: notices.applyStart,
  applyEnd: notices.applyEnd,
  examDate: notices.examDate,
  publishedAt: notices.publishedAt,
  firstSeenAt: notices.firstSeenAt,
  updatedAt: notices.updatedAt,
  verification: notices.verification,
  isCentral: notices.isCentral,
  jobType: notices.jobType,
  notificationUrl: notices.notificationUrl,
  orgName: organizations.name,
  orgShort: organizations.shortName,
  orgSlug: organizations.slug,
  // Only logos marked auto/admin are shown; hidden ones (e.g. the State Emblem) fall back to initials.
  orgLogoId: sql<number | null>`case when ${organizations.logoSource} in ('auto', 'admin') then ${organizations.logoId} end`,
  stateName: states.name,
  stateSlug: states.slug,
  sectorName: sectors.name,
  sectorSlug: sectors.slug,
  /** Up to three detected qualifications, lowest level first, as "slug:name|slug:name". */
  quals: sql<string | null>`(select string_agg(slug || ':' || name, '|') from (select q.slug, q.name from ${noticeQualifications} nq join ${qualifications} q on q.id = nq.qualification_id where nq.notice_id = ${notices.id} order by q.level limit 3) s)`,
};

export type NoticeCard = {
  id: number;
  orgLogoId: number | null;
  slug: string;
  kind: NoticeKind;
  status: (typeof notices.$inferSelect)["status"];
  title: string;
  advtNo: string | null;
  totalPosts: number | null;
  ageMin: number | null;
  ageMax: number | null;
  applyStart: string | null;
  applyEnd: string | null;
  examDate: string | null;
  publishedAt: Date | null;
  firstSeenAt: Date;
  updatedAt: Date;
  verification: "auto" | "reviewed" | "manual";
  isCentral: boolean;
  jobType: (typeof notices.$inferSelect)["jobType"];
  notificationUrl: string | null;
  orgName: string | null;
  orgShort: string | null;
  orgSlug: string | null;
  stateName: string | null;
  stateSlug: string | null;
  sectorName: string | null;
  sectorSlug: string | null;
  quals: string | null;
};

function buildWhere(f: Filters, defaultKind: NoticeKind | "any"): SQL {
  const today = todayIST();
  const kind = f.kind ?? (defaultKind === "any" || f.kinds?.length ? undefined : defaultKind);
  const conds: (SQL | undefined)[] = [inArray(notices.status, [...PUBLIC_STATUSES])];
  if (f.kinds?.length && !f.kind) conds.push(inArray(notices.kind, f.kinds));
  else if (kind) conds.push(eq(notices.kind, kind));
  else conds.push(ne(notices.kind, "other"));

  if (f.scope === "state") conds.push(eq(notices.isCentral, false), isNotNull(notices.stateId));
  if (f.state === "central") conds.push(eq(notices.isCentral, true));
  else if (f.state) conds.push(eq(states.slug, f.state));
  if (f.sector) conds.push(eq(sectors.slug, f.sector));
  if (f.org) conds.push(eq(organizations.slug, f.org));
  if (f.jobType) conds.push(eq(notices.jobType, f.jobType));
  if (f.qual) {
    conds.push(
      sql`exists (select 1 from ${noticeQualifications} nq join ${qualifications} q on q.id = nq.qualification_id where nq.notice_id = ${notices.id} and q.slug = ${f.qual})`,
    );
  }
  if (f.posted) conds.push(gte(sql`coalesce(${notices.publishedAt}, ${notices.firstSeenAt})`, new Date(Date.now() - f.posted * 86_400_000).toISOString()));

  const isRecruitmentView = kind === "recruitment";
  const status = f.status ?? (isRecruitmentView ? "active" : "all");
  if (isRecruitmentView || f.status) {
    const published = eq(notices.status, "published");
    switch (status) {
      case "active":
        conds.push(published, or(isNull(notices.applyEnd), gte(notices.applyEnd, today)));
        break;
      case "open":
        conds.push(published, gte(notices.applyEnd, today), or(isNull(notices.applyStart), lte(notices.applyStart, today)));
        break;
      case "closing":
        conds.push(published, gte(notices.applyEnd, today), lte(notices.applyEnd, addDays(today, 7)));
        break;
      case "upcoming":
        conds.push(published, sql`${notices.applyStart} > ${today}`);
        break;
      case "closed":
        conds.push(or(eq(notices.status, "closed"), lt(notices.applyEnd, today)));
        break;
    }
  }

  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    conds.push(
      or(
        sql`${notices.search} @@ websearch_to_tsquery('english', ${f.q})`,
        ilike(notices.title, like),
        ilike(notices.advtNo, like),
        ilike(notices.keywords, like),
        ilike(organizations.name, like),
        ilike(organizations.shortName, like),
      ),
    );
  }
  return and(...conds)!;
}

function orderFor(f: Filters) {
  const recency = desc(sql`coalesce(${notices.publishedAt}, ${notices.firstSeenAt})`);
  if (f.sort === "closing") return [sql`${notices.applyEnd} asc nulls last`, recency];
  if (f.sort === "posts") return [sql`${notices.totalPosts} desc nulls last`, recency];
  // Editors can pin notices to the top of the default (newest first) order.
  return [desc(notices.pinned), recency, desc(notices.id)];
}

export async function listNotices(f: Filters, defaultKind: NoticeKind | "any" = "recruitment", pageSize = PAGE_SIZE) {
  const db = await getDb();
  const where = buildWhere(f, defaultKind);
  const page = f.page ?? 1;
  const base = db
    .select(cardFields)
    .from(notices)
    .leftJoin(organizations, eq(notices.organizationId, organizations.id))
    .leftJoin(states, eq(notices.stateId, states.id))
    .leftJoin(sectors, eq(notices.sectorId, sectors.id))
    .where(where);
  const [items, [{ total }]] = await Promise.all([
    base
      .orderBy(...orderFor(f))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(notices)
      .leftJoin(organizations, eq(notices.organizationId, organizations.id))
      .leftJoin(states, eq(notices.stateId, states.id))
      .leftJoin(sectors, eq(notices.sectorId, sectors.id))
      .where(where),
  ]);
  return { items: items as NoticeCard[], total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getFilterOptions() {
  const db = await getDb();
  const [st, se, qu] = await Promise.all([
    db.select({ slug: states.slug, name: states.name, type: states.type }).from(states).orderBy(asc(states.name)),
    db.select({ slug: sectors.slug, name: sectors.name }).from(sectors).orderBy(asc(sectors.sort)),
    db.select({ slug: qualifications.slug, name: qualifications.name }).from(qualifications).orderBy(asc(qualifications.level)),
  ]);
  return { states: st, sectors: se, qualifications: qu };
}

/** Active (open or undated, published) recruitment counts grouped by state and by sector. */
export async function activeCounts() {
  const db = await getDb();
  const today = todayIST();
  const active = and(eq(notices.status, "published"), eq(notices.kind, "recruitment"), or(isNull(notices.applyEnd), gte(notices.applyEnd, today)));
  const [byState, bySector, [central], [total], [closing]] = await Promise.all([
    db.select({ stateId: notices.stateId, n: count() }).from(notices).where(active).groupBy(notices.stateId),
    db.select({ sectorId: notices.sectorId, n: count() }).from(notices).where(active).groupBy(notices.sectorId),
    db.select({ n: count() }).from(notices).where(and(active, eq(notices.isCentral, true))),
    db.select({ n: count() }).from(notices).where(active),
    db
      .select({ n: count() })
      .from(notices)
      .where(and(active, gte(notices.applyEnd, today), lte(notices.applyEnd, addDays(today, 7)))),
  ]);
  return {
    byState: new Map(byState.map((r) => [r.stateId, r.n])),
    bySector: new Map(bySector.map((r) => [r.sectorId, r.n])),
    central: central.n,
    total: total.n,
    closingThisWeek: closing.n,
  };
}

export async function freshness() {
  const db = await getDb();
  const configured = and(eq(sources.enabled, true), ne(sources.method, "manual"));
  const [[agg]] = await Promise.all([
    db
      .select({
        lastCheck: sql<Date | null>`max(${sources.lastSuccessAt})`,
        configured: count(),
        // Only sites that actually loaded recently count as "monitored".
        working: sql<number>`count(*) filter (where ${sources.lastSuccessAt} > now() - interval '3 days')::int`,
      })
      .from(sources)
      .where(configured),
  ]);
  return { lastRunAt: agg.lastCheck ? new Date(agg.lastCheck) : null, sourcesMonitored: agg.working, sourcesConfigured: agg.configured };
}

export async function listStates() {
  const db = await getDb();
  return db.select().from(states).orderBy(asc(states.type), asc(states.name));
}

export async function getState(slug: string) {
  const db = await getDb();
  const [state] = await db.select().from(states).where(eq(states.slug, slug));
  if (!state) return null;
  const orgs = await db
    .select({ org: organizations, source: sources })
    .from(organizations)
    .leftJoin(sources, eq(sources.organizationId, organizations.id))
    .where(and(eq(organizations.stateId, state.id), eq(organizations.active, true)))
    .orderBy(asc(organizations.id));
  return { state, orgs: groupSources(orgs) };
}

function groupSources(rows: { org: typeof organizations.$inferSelect; source: typeof sources.$inferSelect | null }[]) {
  const map = new Map<number, { org: typeof organizations.$inferSelect; sources: (typeof sources.$inferSelect)[] }>();
  for (const r of rows) {
    const e = map.get(r.org.id) ?? { org: r.org, sources: [] };
    if (r.source) e.sources.push(r.source);
    map.set(r.org.id, e);
  }
  return [...map.values()];
}

export async function listSectors() {
  const db = await getDb();
  return db.select().from(sectors).orderBy(asc(sectors.sort));
}

export async function getSector(slug: string) {
  const db = await getDb();
  const [sector] = await db.select().from(sectors).where(eq(sectors.slug, slug));
  if (!sector) return null;
  const orgs = await db
    .select({ org: organizations, stateName: states.name })
    .from(organizations)
    .leftJoin(states, eq(organizations.stateId, states.id))
    .where(and(eq(organizations.sectorId, sector.id), eq(organizations.active, true)))
    .orderBy(asc(organizations.name));
  return { sector, orgs };
}

export async function getOrganization(slug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ org: organizations, stateName: states.name, stateSlug: states.slug, sectorName: sectors.name, sectorSlug: sectors.slug })
    .from(organizations)
    .leftJoin(states, eq(organizations.stateId, states.id))
    .leftJoin(sectors, eq(organizations.sectorId, sectors.id))
    .where(eq(organizations.slug, slug));
  if (!row) return null;
  const srcs = await db.select().from(sources).where(eq(sources.organizationId, row.org.id));
  return { ...row, sources: srcs };
}

export async function getQualification(slug: string) {
  const db = await getDb();
  const [q] = await db.select().from(qualifications).where(eq(qualifications.slug, slug));
  return q ?? null;
}

export async function getNotice(slug: string, opts: { includeHidden?: boolean } = {}) {
  const db = await getDb();
  const [row] = await db
    .select({
      n: notices,
      orgName: organizations.name,
      orgShort: organizations.shortName,
      orgSlug: organizations.slug,
      orgLogoId: sql<number | null>`case when ${organizations.logoSource} in ('auto', 'admin') then ${organizations.logoId} end`,
      orgWebsite: organizations.website,
      orgDomains: organizations.officialDomains,
      stateName: states.name,
      stateSlug: states.slug,
      sectorName: sectors.name,
      sectorSlug: sectors.slug,
      sourceName: sources.name,
      sourceUrl: sources.url,
      sourceLastSuccess: sources.lastSuccessAt,
      attachmentId: uploads.id,
      attachmentName: uploads.fileName,
    })
    .from(notices)
    .leftJoin(organizations, eq(notices.organizationId, organizations.id))
    .leftJoin(states, eq(notices.stateId, states.id))
    .leftJoin(sectors, eq(notices.sectorId, sectors.id))
    .leftJoin(sources, eq(notices.sourceId, sources.id))
    .leftJoin(uploads, eq(notices.attachmentId, uploads.id))
    .where(and(eq(notices.slug, slug), opts.includeHidden ? undefined : inArray(notices.status, [...PUBLIC_STATUSES])));
  if (!row) return null;
  const n = row.n;
  const visible = inArray(notices.status, [...PUBLIC_STATUSES]);
  const [quals, children, parent, related, revisions] = await Promise.all([
    db
      .select({ slug: qualifications.slug, name: qualifications.name })
      .from(noticeQualifications)
      .innerJoin(qualifications, eq(noticeQualifications.qualificationId, qualifications.id))
      .where(eq(noticeQualifications.noticeId, n.id))
      .orderBy(asc(qualifications.level)),
    db
      .select({ slug: notices.slug, kind: notices.kind, title: notices.title, publishedAt: notices.publishedAt, firstSeenAt: notices.firstSeenAt })
      .from(notices)
      .where(and(eq(notices.parentId, n.id), visible))
      .orderBy(desc(notices.firstSeenAt)),
    n.parentId
      ? db
          .select({ slug: notices.slug, kind: notices.kind, title: notices.title })
          .from(notices)
          .where(and(eq(notices.id, n.parentId), visible))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    n.organizationId
      ? db
          .select(cardFields)
          .from(notices)
          .leftJoin(organizations, eq(notices.organizationId, organizations.id))
          .leftJoin(states, eq(notices.stateId, states.id))
          .leftJoin(sectors, eq(notices.sectorId, sectors.id))
          .where(and(eq(notices.organizationId, n.organizationId), ne(notices.id, n.id), visible, ne(notices.kind, "other")))
          .orderBy(desc(sql`coalesce(${notices.publishedAt}, ${notices.firstSeenAt})`))
          .limit(6)
      : Promise.resolve([]),
    db
      .select({ changeType: noticeRevisions.changeType, diff: noticeRevisions.diff, createdAt: noticeRevisions.createdAt })
      .from(noticeRevisions)
      .where(and(eq(noticeRevisions.noticeId, n.id), inArray(noticeRevisions.changeType, ["deadline_extended", "deadline_changed", "updated", "cancelled", "withdrawn", "corrigendum", "closed"])))
      .orderBy(desc(noticeRevisions.createdAt))
      .limit(10),
  ]);
  return { ...row, quals, children, parent, related: related as NoticeCard[], revisions };
}

export async function listExams() {
  const db = await getDb();
  return db
    .select({ exam: exams, orgSlug: organizations.slug, orgName: organizations.name })
    .from(exams)
    .leftJoin(organizations, eq(exams.organizationId, organizations.id))
    .where(eq(exams.active, true))
    .orderBy(asc(exams.rank));
}

/** All public notice slugs for the sitemap. */
export async function sitemapEntries() {
  const db = await getDb();
  return db
    .select({ slug: notices.slug, kind: notices.kind, updatedAt: notices.updatedAt, status: notices.status })
    .from(notices)
    .where(and(inArray(notices.status, ["published", "closed"]), ne(notices.kind, "other")))
    .orderBy(desc(notices.updatedAt))
    .limit(45_000);
}

/** Organisations with the most active recruitments right now. */
export async function topRecruiters(limit = 6) {
  const db = await getDb();
  const today = todayIST();
  return db
    .select({ slug: organizations.slug, name: organizations.name, short: organizations.shortName, n: count() })
    .from(notices)
    .innerJoin(organizations, eq(notices.organizationId, organizations.id))
    .where(and(eq(notices.status, "published"), eq(notices.kind, "recruitment"), or(isNull(notices.applyEnd), gte(notices.applyEnd, today))))
    .groupBy(organizations.slug, organizations.name, organizations.shortName)
    .orderBy(desc(count()))
    .limit(limit);
}

/** Recent (7-day) counts of follow-up notices for the homepage quick-access tiles. */
export async function recentUpdateCounts() {
  const db = await getDb();
  // ISO string, not Date: a raw SQL expression gives the driver no column type to serialise a Date with.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = await db
    .select({ kind: notices.kind, n: count() })
    .from(notices)
    .where(and(eq(notices.status, "published"), gte(sql`coalesce(${notices.publishedAt}, ${notices.firstSeenAt})`, since)))
    .groupBy(notices.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Partial<Record<NoticeKind, number>>;
}

/** Short names of each state's commissions/boards (for state tiles), keyed by state id. */
export async function stateRecruiterNames() {
  const db = await getDb();
  const rows = await db
    .select({ stateId: organizations.stateId, short: organizations.shortName })
    .from(organizations)
    .where(and(isNotNull(organizations.stateId), isNotNull(organizations.shortName), eq(organizations.active, true)))
    .orderBy(asc(organizations.id));
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.stateId!) ?? [];
    if (list.length < 2 && !/portal|sso/i.test(r.short!)) list.push(r.short!.replace(/\s*\(.*\)$/, ""));
    map.set(r.stateId!, list);
  }
  return map;
}
