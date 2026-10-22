import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  adminUsers,
  auditLog,
  discoveries,
  noticeQualifications,
  noticeRevisions,
  notices,
  organizations,
  pipelineEvents,
  pipelineRequests,
  pipelineRuns,
  qualifications,
  sectors,
  sources,
  states,
  exams,
  uploads,
  type NoticeKind,
  type NoticeStatus,
  type SourceCheckStatus,
} from "@/db/schema";
import { addDays, todayIST } from "@/pipeline/dates";

export const ADMIN_PAGE = 50;
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

export async function overviewStats() {
  const db = await getDb();
  const today = todayIST();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const n = (where: SQL | undefined) => db.select({ n: count() }).from(notices).where(where).then((r) => r[0].n);
  const [activePublished, needsReview, discovered24h, closingSoon, closed, cancelled, published24h, byStatus, runs, failing, health, lastSuccess, pending, discoveryStates] =
    await Promise.all([
      n(and(eq(notices.status, "published"), eq(notices.kind, "recruitment"), or(sql`${notices.applyEnd} is null`, gte(notices.applyEnd, today)))),
      n(eq(notices.status, "needs_review")),
      db.select({ n: count() }).from(discoveries).where(gte(discoveries.firstSeenAt, dayAgo)).then((r) => r[0].n),
      n(and(eq(notices.status, "published"), gte(notices.applyEnd, today), lte(notices.applyEnd, addDays(today, 7)))),
      n(eq(notices.status, "closed")),
      n(inArray(notices.status, ["cancelled", "withdrawn"])),
      n(and(eq(notices.status, "published"), gte(notices.publishedAt, dayAgo))),
      db.select({ status: notices.status, kind: notices.kind, n: count() }).from(notices).groupBy(notices.status, notices.kind),
      db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(8),
      db
        .select({ id: sources.id, name: sources.name, url: sources.url, failures: sources.consecutiveFailures, lastError: sources.lastError, lastSuccessAt: sources.lastSuccessAt })
        .from(sources)
        .where(and(eq(sources.enabled, true), gte(sources.consecutiveFailures, 3)))
        .orderBy(desc(sources.consecutiveFailures))
        .limit(15),
      db.select({ status: sources.urlStatus, n: count() }).from(sources).where(eq(sources.enabled, true)).groupBy(sources.urlStatus),
      db.select({ at: pipelineRuns.finishedAt }).from(pipelineRuns).where(inArray(pipelineRuns.status, ["success", "partial"])).orderBy(desc(pipelineRuns.finishedAt)).limit(1),
      db.select({ n: count() }).from(pipelineRequests).where(sql`${pipelineRequests.pickedAt} is null`).then((r) => r[0].n),
      db.select({ state: discoveries.state, n: count() }).from(discoveries).groupBy(discoveries.state),
    ]);
  const [checkStates, [extra]] = await Promise.all([
    db
      .select({ status: sql<string>`case when ${sources.enabled} then ${sources.lastCheckStatus} else 'disabled' end`, n: count() })
      .from(sources)
      .groupBy(sql`1`),
    db
      .select({
        duplicates: sql<number>`(select coalesce(sum((stats->>'duplicate')::int), 0)::int from ${pipelineRuns})`,
        amendments: sql<number>`(select coalesce(sum((stats->>'amendment_applied')::int), 0)::int from ${pipelineRuns})`,
        lastCheckAt: sql<Date | null>`(select max(${sources.lastSuccessAt}) from ${sources})`,
        lastDiscoveryAt: sql<Date | null>`(select max(${discoveries.firstSeenAt}) from ${discoveries})`,
        totalSources: sql<number>`(select count(*)::int from ${sources})`,
      })
      .from(sql`(select 1) as x`),
  ]);
  return {
    activePublished,
    needsReview,
    discovered24h,
    closingSoon,
    closed,
    cancelled,
    published24h,
    byStatus,
    runs,
    failing,
    health,
    lastSuccessAt: lastSuccess[0]?.at ?? null,
    pending,
    discoveryStates,
    checkStates,
    duplicatesPrevented: extra.duplicates,
    amendmentsApplied: extra.amendments,
    lastSourceSuccessAt: extra.lastCheckAt ? new Date(extra.lastCheckAt) : null,
    lastDiscoveryAt: extra.lastDiscoveryAt ? new Date(extra.lastDiscoveryAt) : null,
    totalSources: extra.totalSources,
  };
}

export type AdminNoticeFilter = { status?: NoticeStatus; kind?: NoticeKind; q?: string; source?: number; reason?: string; page?: number };

export async function listAdminNotices(f: AdminNoticeFilter) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(notices.status, f.status));
  if (f.kind) conds.push(eq(notices.kind, f.kind));
  if (f.source) conds.push(eq(notices.sourceId, f.source));
  if (f.reason) conds.push(sql`${f.reason} = any(${notices.reviewReasons})`);
  if (f.q) conds.push(or(ilike(notices.title, like(f.q)), ilike(notices.advtNo, like(f.q)), ilike(organizations.name, like(f.q)), ilike(organizations.shortName, like(f.q)))!);
  const where = conds.length ? and(...conds) : undefined;
  const page = f.page ?? 1;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: notices.id,
        slug: notices.slug,
        title: notices.title,
        kind: notices.kind,
        status: notices.status,
        applyEnd: notices.applyEnd,
        verification: notices.verification,
        reviewReasons: notices.reviewReasons,
        firstSeenAt: notices.firstSeenAt,
        orgShort: organizations.shortName,
        orgName: organizations.name,
      })
      .from(notices)
      .leftJoin(organizations, eq(notices.organizationId, organizations.id))
      .where(where)
      .orderBy(desc(notices.firstSeenAt), desc(notices.id))
      .limit(ADMIN_PAGE)
      .offset((page - 1) * ADMIN_PAGE),
    db.select({ total: count() }).from(notices).leftJoin(organizations, eq(notices.organizationId, organizations.id)).where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE)) };
}

export async function reviewReasonCounts() {
  const db = await getDb();
  const r = (await db.execute(
    sql`select r as reason, count(*)::int as n from ${notices}, unnest(${notices.reviewReasons}) r where ${notices.status} = 'needs_review' group by 1 order by 2 desc limit 20`,
  )) as unknown as { rows?: { reason: string; n: number }[] };
  return r.rows ?? (r as unknown as { reason: string; n: number }[]);
}

export async function getAdminNotice(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ n: notices, orgName: organizations.name, sourceName: sources.name, sourceUrl: sources.url })
    .from(notices)
    .leftJoin(organizations, eq(notices.organizationId, organizations.id))
    .leftJoin(sources, eq(notices.sourceId, sources.id))
    .where(eq(notices.id, id));
  if (!row) return null;
  const [quals, revisions, evidence, children] = await Promise.all([
    db.select({ id: noticeQualifications.qualificationId }).from(noticeQualifications).where(eq(noticeQualifications.noticeId, id)),
    db.select().from(noticeRevisions).where(eq(noticeRevisions.noticeId, id)).orderBy(desc(noticeRevisions.createdAt)).limit(50),
    db.select().from(discoveries).where(eq(discoveries.noticeId, id)).orderBy(asc(discoveries.firstSeenAt)).limit(10),
    db.select({ id: notices.id, title: notices.title, kind: notices.kind, status: notices.status }).from(notices).where(eq(notices.parentId, id)),
  ]);
  return { ...row, qualIds: quals.map((q) => q.id), revisions, evidence, children };
}

export async function referenceOptions() {
  const db = await getDb();
  const [st, se, qu, orgs] = await Promise.all([
    db.select({ id: states.id, name: states.name }).from(states).orderBy(asc(states.name)),
    db.select({ id: sectors.id, name: sectors.name }).from(sectors).orderBy(asc(sectors.sort)),
    db.select({ id: qualifications.id, name: qualifications.name }).from(qualifications).orderBy(asc(qualifications.level)),
    db.select({ id: organizations.id, name: organizations.name, short: organizations.shortName }).from(organizations).orderBy(asc(organizations.name)),
  ]);
  return { states: st, sectors: se, qualifications: qu, organizations: orgs };
}

export type SourceFilter = { q?: string; health?: "failing" | "broken" | "disabled" | "never" | "ok"; check?: SourceCheckStatus; page?: number };

export async function listSources(f: SourceFilter) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.q) conds.push(or(ilike(sources.name, like(f.q)), ilike(sources.url, like(f.q)), ilike(organizations.name, like(f.q)))!);
  if (f.health === "failing") conds.push(gte(sources.consecutiveFailures, 1));
  if (f.health === "broken") conds.push(inArray(sources.urlStatus, ["broken", "timeout", "blocked"]));
  if (f.health === "disabled") conds.push(eq(sources.enabled, false));
  if (f.health === "never") conds.push(and(eq(sources.enabled, true), sql`${sources.lastSuccessAt} is null`)!);
  if (f.health === "ok") conds.push(and(eq(sources.consecutiveFailures, 0), isNotNull(sources.lastSuccessAt))!);
  if (f.check) conds.push(and(eq(sources.enabled, true), eq(sources.lastCheckStatus, f.check))!);
  const where = conds.length ? and(...conds) : undefined;
  const page = f.page ?? 1;
  const noticeCount = sql<number>`(select count(*)::int from ${notices} where ${notices.sourceId} = ${sources.id} and ${notices.status} = 'published')`;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ s: sources, orgName: organizations.name, stateName: states.name, published: noticeCount })
      .from(sources)
      .leftJoin(organizations, eq(sources.organizationId, organizations.id))
      .leftJoin(states, eq(organizations.stateId, states.id))
      .where(where)
      .orderBy(asc(sources.priority), desc(sources.consecutiveFailures), asc(sources.name))
      .limit(ADMIN_PAGE)
      .offset((page - 1) * ADMIN_PAGE),
    db.select({ total: count() }).from(sources).leftJoin(organizations, eq(sources.organizationId, organizations.id)).where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE)) };
}

export async function getSourceDetail(id: number) {
  const db = await getDb();
  const [row] = await db.select({ s: sources, orgName: organizations.name, orgSlug: organizations.slug }).from(sources).leftJoin(organizations, eq(sources.organizationId, organizations.id)).where(eq(sources.id, id));
  if (!row) return null;
  const [events, recent] = await Promise.all([
    db.select().from(pipelineEvents).where(eq(pipelineEvents.sourceId, id)).orderBy(desc(pipelineEvents.createdAt)).limit(30),
    db
      .select({ id: discoveries.id, url: discoveries.url, linkText: discoveries.linkText, state: discoveries.state, lastError: discoveries.lastError, firstSeenAt: discoveries.firstSeenAt, noticeId: discoveries.noticeId, attempts: discoveries.attempts })
      .from(discoveries)
      .where(eq(discoveries.sourceId, id))
      .orderBy(desc(discoveries.firstSeenAt))
      .limit(40),
  ]);
  return { ...row, events, recent };
}

export async function listRuns(page = 1) {
  const db = await getDb();
  return db.select({ r: pipelineRuns, sourceName: sources.name }).from(pipelineRuns).leftJoin(sources, eq(pipelineRuns.sourceId, sources.id)).orderBy(desc(pipelineRuns.startedAt)).limit(30).offset((page - 1) * 30);
}

export async function getRun(id: number) {
  const db = await getDb();
  const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id));
  if (!run) return null;
  const events = await db
    .select({ e: pipelineEvents, sourceName: sources.name })
    .from(pipelineEvents)
    .leftJoin(sources, eq(pipelineEvents.sourceId, sources.id))
    .where(eq(pipelineEvents.runId, id))
    .orderBy(desc(pipelineEvents.id))
    .limit(300);
  return { run, events };
}

export async function failedDiscoveries() {
  const db = await getDb();
  return db
    .select({ d: discoveries, sourceName: sources.name })
    .from(discoveries)
    .innerJoin(sources, eq(discoveries.sourceId, sources.id))
    .where(eq(discoveries.state, "failed"))
    .orderBy(desc(discoveries.lastSeenAt))
    .limit(50);
}

export async function listAudit(page = 1) {
  const db = await getDb();
  return db
    .select({ a: auditLog, email: adminUsers.email })
    .from(auditLog)
    .leftJoin(adminUsers, eq(auditLog.userId, adminUsers.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(100)
    .offset((page - 1) * 100);
}

export async function listAdminUsers() {
  const db = await getDb();
  return db.select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, lastLoginAt: adminUsers.lastLoginAt }).from(adminUsers).orderBy(asc(adminUsers.email));
}

export async function listOrganizationsAdmin(q?: string) {
  const db = await getDb();
  return db
    .select({ o: organizations, stateName: states.name, sectorName: sectors.name })
    .from(organizations)
    .leftJoin(states, eq(organizations.stateId, states.id))
    .leftJoin(sectors, eq(organizations.sectorId, sectors.id))
    .where(q ? or(ilike(organizations.name, like(q)), ilike(organizations.shortName, like(q))) : undefined)
    .orderBy(asc(organizations.name))
    .limit(300);
}


// ---------- content manager ----------

export const CONTENT_PAGE = 50;
export type ContentFilter = {
  q?: string;
  kind?: NoticeKind;
  status?: NoticeStatus;
  stateId?: number;
  orgId?: number;
  origin?: "manual" | "auto";
  from?: string;
  to?: string;
  page?: number;
};

export async function listContent(f: ContentFilter) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.kind) conds.push(eq(notices.kind, f.kind));
  if (f.status) conds.push(eq(notices.status, f.status));
  if (f.stateId) conds.push(eq(notices.stateId, f.stateId));
  if (f.orgId) conds.push(eq(notices.organizationId, f.orgId));
  // Manual = created by an editor (no harvested link behind it).
  if (f.origin === "manual") conds.push(and(eq(notices.verification, "manual"), sql`${notices.dedupeKey} is null`)!);
  if (f.origin === "auto") conds.push(sql`${notices.dedupeKey} is not null`);
  if (f.from) conds.push(sql`${notices.createdAt} >= ${f.from}::date`);
  if (f.to) conds.push(sql`${notices.createdAt} < (${f.to}::date + 1)`);
  if (f.q) conds.push(or(ilike(notices.title, like(f.q)), ilike(notices.advtNo, like(f.q)), ilike(notices.keywords, like(f.q)), ilike(organizations.name, like(f.q)), ilike(organizations.shortName, like(f.q)))!);
  const where = conds.length ? and(...conds) : undefined;
  const page = f.page ?? 1;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: notices.id,
        slug: notices.slug,
        title: notices.title,
        kind: notices.kind,
        status: notices.status,
        pinned: notices.pinned,
        verification: notices.verification,
        manual: sql<boolean>`(${notices.verification} = 'manual' and ${notices.dedupeKey} is null)`,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        publishedAt: notices.publishedAt,
        orgShort: organizations.shortName,
        orgName: organizations.name,
        stateName: states.name,
        sourceName: sources.name,
      })
      .from(notices)
      .leftJoin(organizations, eq(notices.organizationId, organizations.id))
      .leftJoin(states, eq(notices.stateId, states.id))
      .leftJoin(sources, eq(notices.sourceId, sources.id))
      .where(where)
      .orderBy(desc(notices.updatedAt), desc(notices.id))
      .limit(CONTENT_PAGE)
      .offset((page - 1) * CONTENT_PAGE),
    db.select({ total: count() }).from(notices).leftJoin(organizations, eq(notices.organizationId, organizations.id)).where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / CONTENT_PAGE)) };
}

/** Counts per section and status for the content manager's header. */
export async function contentCounts() {
  const db = await getDb();
  return db.select({ kind: notices.kind, status: notices.status, n: count() }).from(notices).groupBy(notices.kind, notices.status);
}

export async function getUploadMeta(id: number | null) {
  if (!id) return null;
  const db = await getDb();
  const [u] = await db.select({ id: uploads.id, fileName: uploads.fileName, size: uploads.size, createdAt: uploads.createdAt }).from(uploads).where(eq(uploads.id, id));
  return u ?? null;
}

export async function listExamsAdmin() {
  const db = await getDb();
  return db
    .select({ e: exams, orgShort: organizations.shortName, orgName: organizations.name })
    .from(exams)
    .leftJoin(organizations, eq(exams.organizationId, organizations.id))
    .orderBy(asc(exams.group), asc(exams.rank), asc(exams.name));
}
