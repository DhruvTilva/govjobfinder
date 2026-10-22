import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  noticeQualifications,
  noticeRevisions,
  notices,
  siteSettings,
  type FieldSource,
  type ImportantDate,
  type NoticeKind,
  type NoticeStatus,
} from "@/db/schema";
import { slugify } from "@/lib/text";
import { normalizeUrl } from "@/lib/url";
import { normalizeAdvt, similarity } from "@/pipeline/process";
import { todayIST } from "@/pipeline/dates";

/**
 * Content manager logic shared by the /bigboss/content actions. Notices created here are the
 * same `notices` rows the public site and the pipeline use, so every public page (listings,
 * search, state/sector pages, detail page, homepage boards) picks them up without extra code.
 * Functions take the database and the acting admin so they can be tested directly.
 */

export type Actor = { id: number; email: string };

/** Website sections an editor can add to. Each is a notice kind with its public page. */
export const SECTIONS = [
  { key: "jobs", kind: "recruitment", label: "Latest Government Jobs", path: "/jobs", hint: "Also feeds Closing Soon (last date within 7 days), State Jobs and Sectors through its dates, state and sector." },
  { key: "admit-cards", kind: "admit_card", label: "Admit Cards & City Slips", path: "/admit-cards" },
  { key: "results", kind: "result", label: "Results & Merit Lists", path: "/results" },
  { key: "answer-keys", kind: "answer_key", label: "Answer Keys", path: "/answer-keys" },
  { key: "admissions", kind: "admission", label: "Admissions", path: "/admissions" },
  { key: "syllabus", kind: "syllabus", label: "Syllabus & Exam Pattern", path: "/updates" },
  { key: "exam-dates", kind: "exam_date", label: "Exam Dates & Schedules", path: "/updates" },
] as const satisfies readonly { key: string; kind: NoticeKind; label: string; path: string; hint?: string }[];

export const sectionForKind = (kind: NoticeKind) => SECTIONS.find((s) => s.kind === kind);

/** Fields only meaningful for job notices; the editor hides them for other kinds. */
export const JOB_ONLY_FIELDS = ["applyStart", "applyEnd", "totalPosts", "ageMin", "ageMax", "ageText", "feeText", "salaryText", "qualificationText", "experienceText", "jobType", "postNames", "documentsText"] as const;

export type ContentInput = {
  title: string;
  kind: NoticeKind;
  summary?: string | null;
  organizationId?: number | null;
  stateId?: number | null;
  sectorId?: number | null;
  parentId?: number | null;
  isCentral?: boolean;
  advtNo?: string | null;
  totalPosts?: number | null;
  postNames?: string | null;
  location?: string | null;
  qualificationText?: string | null;
  experienceText?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  ageText?: string | null;
  feeText?: string | null;
  salaryText?: string | null;
  jobType?: "permanent" | "contract" | "apprentice" | "deputation" | "unknown";
  selectionText?: string | null;
  howToApply?: string | null;
  documentsText?: string | null;
  noticeDate?: string | null;
  applyStart?: string | null;
  applyEnd?: string | null;
  examDate?: string | null;
  notificationUrl?: string | null;
  applyUrl?: string | null;
  importantDates?: ImportantDate[];
  keywords?: string | null;
  pinned?: boolean;
  attachmentId?: number | null;
  qualIds?: number[];
};

/** Columns compared for change history and marked as editor-owned when changed. */
const EDITABLE = [
  "title", "kind", "summary", "organizationId", "stateId", "sectorId", "parentId", "isCentral", "advtNo", "totalPosts", "postNames", "location",
  "qualificationText", "experienceText", "ageMin", "ageMax", "ageText", "feeText", "salaryText", "jobType", "selectionText", "howToApply",
  "documentsText", "noticeDate", "applyStart", "applyEnd", "examDate", "notificationUrl", "applyUrl", "importantDates", "keywords", "pinned", "attachmentId",
] as const;

/** Removes job-only values from non-job kinds, so no stale "last date" shows on a result. */
function normalise(input: ContentInput): ContentInput {
  const v: ContentInput = { ...input, importantDates: (input.importantDates ?? []).filter((d) => d.label?.trim() && (d.date || d.text)) };
  if (v.kind !== "recruitment") {
    for (const k of JOB_ONLY_FIELDS) (v as Record<string, unknown>)[k] = k === "jobType" ? "unknown" : null;
  }
  return v;
}

export function validateContent(v: ContentInput): string | null {
  if (v.applyStart && v.applyEnd && v.applyStart > v.applyEnd) return "Application start is after the last date.";
  if (v.ageMin && v.ageMax && v.ageMin > v.ageMax) return "Minimum age is greater than maximum age.";
  return null;
}

/** A notice is manual when an editor created it (no harvested link behind it). */
export const isManual = (n: { verification: string; dedupeKey: string | null }) => n.verification === "manual" && !n.dedupeKey;

export type DuplicateHit = { id: number; title: string; status: NoticeStatus; reason: string };

/**
 * Notices that look like the same notification: same official URL, same organisation and
 * advertisement number, or a near-identical title from the same organisation and kind.
 */
export async function findDuplicates(db: DB, v: Pick<ContentInput, "title" | "kind" | "organizationId" | "advtNo" | "notificationUrl">, excludeId?: number): Promise<DuplicateHit[]> {
  const conds = [];
  let urlKey: string | null = null;
  if (v.notificationUrl) {
    try {
      urlKey = normalizeUrl(v.notificationUrl);
    } catch {
      urlKey = null;
    }
  }
  if (urlKey) conds.push(sql`${notices.notificationUrl} is not null`);
  if (v.organizationId) conds.push(eq(notices.organizationId, v.organizationId));
  if (!conds.length) return [];
  const rows = await db
    .select({ id: notices.id, title: notices.title, status: notices.status, kind: notices.kind, advtNo: notices.advtNo, notificationUrl: notices.notificationUrl, organizationId: notices.organizationId })
    .from(notices)
    .where(and(or(...conds), excludeId ? ne(notices.id, excludeId) : undefined, ne(notices.status, "rejected")))
    .limit(2000);
  const advt = normalizeAdvt(v.advtNo);
  const hits: DuplicateHit[] = [];
  for (const r of rows) {
    let reason: string | null = null;
    if (urlKey && r.notificationUrl) {
      try {
        if (normalizeUrl(r.notificationUrl) === urlKey) reason = "same official notification URL";
      } catch {
        /* ignore malformed stored URL */
      }
    }
    if (!reason && advt && v.organizationId && r.organizationId === v.organizationId && r.kind === v.kind && normalizeAdvt(r.advtNo) === advt) reason = "same organisation and advertisement number";
    if (!reason && v.organizationId && r.organizationId === v.organizationId && r.kind === v.kind && similarity(v.title, r.title) >= 0.8) reason = "near-identical title from the same organisation";
    if (reason) hits.push({ id: r.id, title: r.title, status: r.status, reason });
  }
  return hits.slice(0, 5);
}

async function replaceQualifications(db: DB, noticeId: number, qualIds: number[] | undefined) {
  if (!qualIds) return;
  await db.delete(noticeQualifications).where(eq(noticeQualifications.noticeId, noticeId));
  if (qualIds.length) await db.insert(noticeQualifications).values(qualIds.map((qualificationId) => ({ noticeId, qualificationId })));
}

export type CreateResult = { id: number } | { duplicates: DuplicateHit[] };

/** Creates an editor notice as a draft or published. Refuses likely duplicates unless allowed. */
export async function createContent(db: DB, actor: Actor, input: ContentInput, opts: { publish?: boolean; allowDuplicate?: boolean } = {}): Promise<CreateResult> {
  const v = normalise(input);
  if (!opts.allowDuplicate) {
    const duplicates = await findDuplicates(db, v);
    if (duplicates.length) return { duplicates };
  }
  const { qualIds, ...cols } = v;
  const now = new Date();
  const status: NoticeStatus = opts.publish ? "published" : "draft";
  const [created] = await db
    .insert(notices)
    .values({
      ...cols,
      importantDates: cols.importantDates ?? [],
      slug: `${slugify(v.title, 70)}-${randomBytes(3).toString("hex")}`,
      status,
      verification: "manual",
      fieldSources: Object.fromEntries(EDITABLE.filter((k) => (v as Record<string, unknown>)[k] != null && k !== "pinned").map((k) => [k, "admin" as FieldSource])),
      reviewReasons: [],
      firstSeenAt: now,
      publishedAt: opts.publish ? now : null,
    })
    .returning({ id: notices.id });
  await replaceQualifications(db, created.id, qualIds);
  await db.insert(noticeRevisions).values({ noticeId: created.id, changeType: "created", diff: { status: [null, status] }, actor: `admin:${actor.email}` });
  return { id: created.id };
}

export type UpdateResult = { ok: true; changed: string[] } | { conflict: Date } | { notFound: true };

/**
 * Saves an edit. `expectedUpdatedAt` is the version the editor loaded: if someone (an editor
 * or the pipeline) changed the notice since, the save is refused instead of silently
 * overwriting their change. Changed fields are marked editor-owned so the pipeline keeps them.
 */
export async function updateContent(db: DB, actor: Actor, id: number, input: ContentInput, expectedUpdatedAt: Date | null): Promise<UpdateResult> {
  const v = normalise(input);
  const [existing] = await db.select().from(notices).where(eq(notices.id, id));
  if (!existing) return { notFound: true };
  if (expectedUpdatedAt && Math.abs(existing.updatedAt.getTime() - expectedUpdatedAt.getTime()) > 1) return { conflict: existing.updatedAt };
  const { qualIds, ...cols } = v;
  const diff: Record<string, [unknown, unknown]> = {};
  const fieldSources = { ...existing.fieldSources };
  for (const k of EDITABLE) {
    const before = (existing as Record<string, unknown>)[k] ?? null;
    const after = (cols as Record<string, unknown>)[k] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[k] = [before, after];
      if (k !== "pinned") fieldSources[k] = "admin";
    }
  }
  const today = todayIST();
  const reopen = existing.status === "closed" && v.kind === "recruitment" && v.applyEnd && v.applyEnd >= today;
  await db
    .update(notices)
    .set({ ...cols, importantDates: cols.importantDates ?? [], fieldSources, updatedAt: new Date(), ...(reopen ? { status: "published" as const, closedAt: null } : {}) })
    .where(eq(notices.id, id));
  await replaceQualifications(db, id, qualIds);
  if (Object.keys(diff).length) {
    await db.insert(noticeRevisions).values({ noticeId: id, changeType: diff.applyEnd ? "deadline_changed" : "updated", diff, actor: `admin:${actor.email}` });
  }
  return { ok: true, changed: Object.keys(diff) };
}

/** Status changes available in the content manager. */
export const CONTENT_ACTIONS = ["publish", "unpublish", "archive"] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

/**
 * publish → public; unpublish → draft for editor notices, review queue for collected ones;
 * archive → hidden from every public page. Collected notices keep verification "auto"→"reviewed"
 * when an editor publishes them; editor notices stay "manual" so their origin is never lost.
 */
export async function setContentStatus(db: DB, actor: Actor, ids: number[], action: ContentAction): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db.select({ id: notices.id, status: notices.status, verification: notices.verification, dedupeKey: notices.dedupeKey, publishedAt: notices.publishedAt }).from(notices).where(inArray(notices.id, ids));
  let changed = 0;
  for (const r of rows) {
    const manual = isManual(r);
    const status: NoticeStatus = action === "publish" ? "published" : action === "archive" ? "archived" : manual ? "draft" : "needs_review";
    if (r.status === status) continue;
    await db
      .update(notices)
      .set({
        status,
        updatedAt: new Date(),
        ...(action === "publish" ? { reviewReasons: [], publishedAt: r.publishedAt ?? new Date(), ...(manual ? {} : { verification: "reviewed" as const }) } : {}),
      })
      .where(eq(notices.id, r.id));
    await db.insert(noticeRevisions).values({ noticeId: r.id, changeType: "status", diff: { status: [r.status, status] }, actor: `admin:${actor.email}` });
    changed++;
  }
  return changed;
}

/**
 * Deletes notices permanently. For collected notices the harvested link stays recorded as
 * processed (its notice reference is cleared by the foreign key), so the pipeline does not
 * re-create what an editor deleted.
 */
export async function deleteContent(db: DB, ids: number[]): Promise<{ id: number; title: string }[]> {
  if (!ids.length) return [];
  const rows = await db.select({ id: notices.id, title: notices.title }).from(notices).where(inArray(notices.id, ids));
  if (!rows.length) return [];
  await db.update(notices).set({ parentId: null }).where(inArray(notices.parentId, rows.map((r) => r.id)));
  await db.delete(notices).where(inArray(notices.id, rows.map((r) => r.id)));
  return rows;
}

/** Copies a notice into a new editor draft (e.g. next year's edition of a recurring notice). */
export async function duplicateContent(db: DB, actor: Actor, id: number): Promise<number | null> {
  const [n] = await db.select().from(notices).where(eq(notices.id, id));
  if (!n) return null;
  const quals = await db.select({ id: noticeQualifications.qualificationId }).from(noticeQualifications).where(eq(noticeQualifications.noticeId, id));
  const input: ContentInput = {
    ...Object.fromEntries(EDITABLE.map((k) => [k, (n as Record<string, unknown>)[k]])),
    title: `${n.title} (copy)`.slice(0, 300),
    pinned: false,
    qualIds: quals.map((q) => q.id),
  } as ContentInput;
  const res = await createContent(db, actor, input, { allowDuplicate: true });
  return "id" in res ? res.id : null;
}

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export type PopularSearch = { en: string; hi: string; q: string };
export type Announcement = { active: boolean; text: string; textHi?: string; url?: string; tone: "info" | "urgent" };

export const DEFAULT_POPULAR: PopularSearch[] = [
  { en: "SSC", hi: "SSC", q: "SSC" },
  { en: "Railway", hi: "रेलवे", q: "Railway" },
  { en: "Police constable", hi: "पुलिस कांस्टेबल", q: "Police constable" },
  { en: "Teacher", hi: "शिक्षक", q: "Teacher" },
  { en: "Staff nurse", hi: "स्टाफ नर्स", q: "Staff nurse" },
  { en: "Junior engineer", hi: "जूनियर इंजीनियर", q: "Junior engineer" },
  { en: "Bank", hi: "बैंक", q: "Bank" },
  { en: "Apprentice", hi: "अप्रेंटिस", q: "Apprentice" },
  { en: "Clerk", hi: "क्लर्क", q: "Clerk" },
  { en: "Scientist", hi: "वैज्ञानिक", q: "Scientist" },
];

export type SiteSettings = { popularSearches: PopularSearch[]; announcement: Announcement | null };

export async function getSiteSettings(db: DB): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, ["popular_searches", "announcement"]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const popular = map.get("popular_searches");
  return {
    popularSearches: Array.isArray(popular) && popular.length ? (popular as PopularSearch[]) : DEFAULT_POPULAR,
    announcement: (map.get("announcement") as Announcement | undefined) ?? null,
  };
}

export async function saveSiteSetting(db: DB, actorId: number, key: "popular_searches" | "announcement", value: unknown) {
  await db
    .insert(siteSettings)
    .values({ key, value: value as object, updatedBy: actorId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: value as object, updatedBy: actorId, updatedAt: new Date() } });
}
