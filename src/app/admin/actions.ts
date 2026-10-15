"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  adminUsers,
  discoveries,
  NOTICE_KINDS,
  noticeQualifications,
  noticeRevisions,
  notices,
  organizations,
  pipelineRequests,
  qualifications,
  sectors,
  sources,
  states,
  type FieldSource,
} from "@/db/schema";
import { audit, hashPassword, login, logout, requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/text";
import { hostnameOf, safeHref } from "@/lib/url";
import { assertFetchableUrl } from "@/pipeline/net";
import { validateSourceUrl } from "@/pipeline/validate";
import { runPipeline } from "@/pipeline/run";
import { requeueForReprocessing } from "@/pipeline/process";
import { todayIST } from "@/pipeline/dates";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

// ---------- helpers ----------

const optText = (max = 4000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable())
    .optional();
const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable())
  .optional();
const optUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || safeHref(v) !== null, "Must be an http(s) URL")
  .nullable()
  .optional();
const optId = optInt(1, 2_147_483_647);

function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) o[k] = v;
  return o;
}

function firstError(e: z.ZodError) {
  const i = e.issues[0];
  return `${i.path.join(".") || "Input"}: ${i.message}`;
}

// ---------- auth ----------

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).safeParse(formObject(fd));
  if (!parsed.success) return { error: "Enter your email and password." };
  const res = await login(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

// ---------- notices ----------

const NoticeForm = z.object({
  title: z.string().trim().min(5, "Title is too short").max(300),
  kind: z.enum(NOTICE_KINDS),
  organizationId: optId,
  stateId: optId,
  sectorId: optId,
  parentId: optId,
  isCentral: z.string().optional().transform((v) => v === "on"),
  summary: optText(1500),
  advtNo: optText(120),
  totalPosts: optInt(1, 500000),
  postNames: optText(1000),
  location: optText(300),
  qualificationText: optText(),
  experienceText: optText(),
  ageMin: optInt(14, 70),
  ageMax: optInt(14, 70),
  ageText: optText(1000),
  feeText: optText(1500),
  salaryText: optText(1500),
  jobType: z.enum(["permanent", "contract", "apprentice", "deputation", "unknown"]),
  selectionText: optText(),
  howToApply: optText(),
  documentsText: optText(),
  noticeDate: optDate,
  applyStart: optDate,
  applyEnd: optDate,
  examDate: optDate,
  notificationUrl: optUrl,
  applyUrl: optUrl,
});

const TRACKED_FIELDS = [
  "title", "kind", "organizationId", "stateId", "sectorId", "parentId", "isCentral", "summary", "advtNo", "totalPosts", "postNames", "location",
  "qualificationText", "experienceText", "ageMin", "ageMax", "ageText", "feeText", "salaryText", "jobType", "selectionText", "howToApply",
  "documentsText", "noticeDate", "applyStart", "applyEnd", "examDate", "notificationUrl", "applyUrl",
] as const;

export async function saveNotice(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const parsed = NoticeForm.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  if (v.applyStart && v.applyEnd && v.applyStart > v.applyEnd) return { error: "Application start is after the last date." };
  if (v.ageMin && v.ageMax && v.ageMin > v.ageMax) return { error: "Minimum age is greater than maximum age." };
  const qualIds = fd.getAll("qualIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const db = await getDb();

  if (!id) {
    const [created] = await db
      .insert(notices)
      .values({
        ...v,
        slug: `${slugify(v.title, 70)}-${randomBytes(3).toString("hex")}`,
        status: "needs_review",
        verification: "manual",
        fieldSources: Object.fromEntries(TRACKED_FIELDS.filter((k) => v[k] != null).map((k) => [k, "admin" as FieldSource])),
        reviewReasons: ["Created manually — publish when ready"],
      })
      .returning({ id: notices.id });
    if (qualIds.length) await db.insert(noticeQualifications).values(qualIds.map((qualificationId) => ({ noticeId: created.id, qualificationId })));
    await db.insert(noticeRevisions).values({ noticeId: created.id, changeType: "created", diff: {}, actor: `admin:${user.email}` });
    await audit(user.id, "create", "notice", String(created.id), { title: v.title });
    redirect(`/admin/notices/${created.id}?saved=1`);
  }

  const [existing] = await db.select().from(notices).where(eq(notices.id, id));
  if (!existing) return { error: "Notice not found." };
  const diff: Record<string, [unknown, unknown]> = {};
  const fieldSources = { ...existing.fieldSources };
  for (const k of TRACKED_FIELDS) {
    const before = (existing as Record<string, unknown>)[k] ?? null;
    const after = (v as Record<string, unknown>)[k] ?? null;
    if (before !== after) {
      diff[k] = [before, after];
      fieldSources[k] = "admin";
    }
  }
  const today = todayIST();
  const reopen = existing.status === "closed" && v.applyEnd && v.applyEnd >= today;
  await db
    .update(notices)
    .set({ ...v, fieldSources, updatedAt: new Date(), ...(reopen ? { status: "published", closedAt: null } : {}) })
    .where(eq(notices.id, id));
  await db.delete(noticeQualifications).where(eq(noticeQualifications.noticeId, id));
  if (qualIds.length) await db.insert(noticeQualifications).values(qualIds.map((qualificationId) => ({ noticeId: id, qualificationId })));
  if (Object.keys(diff).length) {
    await db.insert(noticeRevisions).values({ noticeId: id, changeType: diff.applyEnd ? "deadline_changed" : "updated", diff, actor: `admin:${user.email}` });
    await audit(user.id, "update", "notice", String(id), { fields: Object.keys(diff) });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: Object.keys(diff).length ? `Saved ${Object.keys(diff).length} change(s).` : "No changes." };
}

const STATUS_ACTIONS = {
  publish: "published",
  unpublish: "needs_review",
  reject: "rejected",
  archive: "archived",
  cancel: "cancelled",
  withdraw: "withdrawn",
  close: "closed",
} as const;
type StatusAction = keyof typeof STATUS_ACTIONS;

async function applyStatus(ids: number[], action: StatusAction, actor: { id: number; email: string }) {
  const db = await getDb();
  const status = STATUS_ACTIONS[action];
  const rows = await db.select({ id: notices.id, status: notices.status, publishedAt: notices.publishedAt }).from(notices).where(inArray(notices.id, ids));
  for (const r of rows) {
    if (r.status === status) continue;
    await db
      .update(notices)
      .set({
        status,
        updatedAt: new Date(),
        ...(action === "publish" ? { verification: "reviewed" as const, reviewReasons: [], publishedAt: r.publishedAt ?? new Date() } : {}),
        ...(action === "close" ? { closedAt: new Date() } : {}),
      })
      .where(eq(notices.id, r.id));
    await db.insert(noticeRevisions).values({
      noticeId: r.id,
      changeType: ["cancel", "withdraw"].includes(action) ? status : "status",
      diff: { status: [r.status, status] },
      actor: `admin:${actor.email}`,
    });
  }
  await audit(actor.id, action, "notice", ids.join(","), { count: rows.length });
  revalidatePath("/", "layout");
  return rows.length;
}

export async function noticeStatusAction(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action")) as StatusAction;
  if (!id || !(action in STATUS_ACTIONS)) return;
  await applyStatus([id], action, user);
  redirect(`/admin/notices/${id}?status=${action}`);
}

export async function bulkNoticeAction(fd: FormData) {
  const user = await requireAdmin();
  const ids = fd.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  const action = String(fd.get("action")) as StatusAction;
  const back = String(fd.get("back") ?? "/admin/notices");
  if (ids.length && action in STATUS_ACTIONS && ["publish", "reject", "archive", "unpublish"].includes(action)) await applyStatus(ids, action, user);
  redirect(back.startsWith("/admin/") ? back : "/admin/notices");
}

/**
 * Re-runs collection for an unpublished auto-collected notice: the notice is
 * removed and its discovery re-queued, so improved extraction rules apply.
 */
export async function reprocessNotice(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const db = await getDb();
  const [n] = await db.select().from(notices).where(eq(notices.id, id));
  if (!n || n.verification !== "auto" || !["needs_review", "archived", "rejected"].includes(n.status) || !n.dedupeKey) {
    redirect(`/admin/notices/${id}?error=reprocess`);
  }
  await db.update(discoveries).set({ state: "new", attempts: 0, noticeId: null, lastError: null, nextAttemptAt: null }).where(eq(discoveries.noticeId, id));
  await db.update(notices).set({ parentId: null }).where(eq(notices.parentId, id));
  await db.delete(notices).where(eq(notices.id, id));
  await audit(user.id, "reprocess", "notice", String(id), { title: n.title });
  redirect(`/admin/notices?status=needs_review&reprocessed=1`);
}

// ---------- sources ----------

const SourceForm = z.object({
  name: z.string().trim().min(2).max(200),
  url: z.string().trim().url().max(500),
  organizationId: optId,
  method: z.enum(["html_links", "rss", "sitemap", "manual"]),
  priority: z.coerce.number().int().min(1).max(3),
  intervalMinutes: z.coerce.number().int().min(30).max(10_080),
  trust: z.enum(["trusted", "review"]),
  enabled: z.string().optional().transform((v) => v === "on"),
  allowedDomains: z.string().max(1000).default(""),
  selector: optText(300),
  include: optText(2000),
  exclude: optText(2000),
  fetchDocuments: z.string().optional().transform((v) => v === "on"),
  maxItems: optInt(1, 200),
  notes: optText(2000),
});

function compileCheck(lines: string | null | undefined): string[] | { error: string } {
  const list = (lines ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  for (const p of list) {
    try {
      new RegExp(p, "i");
    } catch {
      return { error: `Invalid pattern: ${p}` };
    }
  }
  return list;
}

export async function saveSource(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const parsed = SourceForm.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  try {
    assertFetchableUrl(v.url);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "URL is not allowed" };
  }
  const include = compileCheck(v.include);
  const exclude = compileCheck(v.exclude);
  if (!Array.isArray(include)) return include;
  if (!Array.isArray(exclude)) return exclude;
  const host = hostnameOf(v.url)!;
  const domains = [...new Set([host, ...v.allowedDomains.split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^www\./, "")).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))])];
  const values = {
    name: v.name,
    url: v.url,
    organizationId: v.organizationId ?? null,
    method: v.method,
    priority: v.priority,
    intervalMinutes: v.intervalMinutes,
    trust: v.trust,
    enabled: v.enabled,
    allowedDomains: domains,
    config: {
      ...(v.selector ? { selector: v.selector } : {}),
      ...(include.length ? { include } : {}),
      ...(exclude.length ? { exclude } : {}),
      ...(v.fetchDocuments ? {} : { fetchDocuments: false }),
      ...(v.maxItems ? { maxItems: v.maxItems } : {}),
    },
    notes: v.notes ?? null,
    updatedAt: new Date(),
  };
  const db = await getDb();
  try {
    if (id) {
      await db.update(sources).set({ ...values, nextCheckAt: null, contentHash: null }).where(eq(sources.id, id));
      await audit(user.id, "update", "source", String(id), { url: v.url });
    } else {
      const [created] = await db.insert(sources).values(values).returning({ id: sources.id });
      await audit(user.id, "create", "source", String(created.id), { url: v.url });
      redirect(`/admin/sources/${created.id}?saved=1`);
    }
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { error: "A source with this URL already exists." };
    throw e;
  }
  revalidatePath("/admin/sources");
  return { ok: true, message: "Source saved. It will be scanned on the next run." };
}

export async function sourceAction(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  const db = await getDb();
  const [s] = await db.select().from(sources).where(eq(sources.id, id));
  if (!s) redirect("/admin/sources");
  let msg = "";
  if (action === "toggle") {
    await db.update(sources).set({ enabled: !s.enabled, updatedAt: new Date() }).where(eq(sources.id, id));
    msg = s.enabled ? "disabled" : "enabled";
  } else if (action === "validate") {
    const r = await validateSourceUrl(db, id, s.url);
    msg = `url-${r.status}`;
  } else if (action === "scan") {
    const r = await runPipeline(db, { trigger: "source", sourceIds: [id], allowConcurrent: true, timeBudgetMs: 45_000, processLimit: 12 });
    msg = `scanned-${r.runId}`;
  } else if (action === "queue") {
    await db.insert(pipelineRequests).values({ sourceId: id, requestedBy: user.id });
    msg = "queued";
  } else if (action === "reset") {
    await db.update(sources).set({ consecutiveFailures: 0, nextCheckAt: null, lastError: null, contentHash: null, etag: null, lastModified: null }).where(eq(sources.id, id));
    msg = "reset";
  }
  await audit(user.id, `source_${action}`, "source", String(id));
  redirect(`/admin/sources/${id}?done=${msg}`);
}

// ---------- pipeline ----------

export async function requestFullRun() {
  const user = await requireAdmin();
  const db = await getDb();
  await db.insert(pipelineRequests).values({ requestedBy: user.id });
  let dispatched = false;
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (token && repo && /^[\w.-]+\/[\w.-]+$/.test(repo)) {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || "main" }),
    }).catch(() => null);
    dispatched = !!res?.ok;
  }
  await audit(user.id, "request_run", "pipeline", null, { dispatched });
  redirect(`/admin/pipeline?requested=${dispatched ? "dispatched" : "queued"}`);
}

export async function reprocessReviewQueue() {
  const user = await requireAdmin();
  const n = await requeueForReprocessing(await getDb(), ["needs_review", "archived"]);
  await audit(user.id, "reprocess_review_queue", "pipeline", null, { requeued: n });
  redirect(`/admin/pipeline?reprocessed=${n}`);
}

export async function retryDiscoveries(fd: FormData) {
  const user = await requireAdmin();
  const db = await getDb();
  const id = Number(fd.get("id")) || null;
  await db
    .update(discoveries)
    .set({ nextAttemptAt: new Date(0), attempts: 0 })
    .where(id ? and(eq(discoveries.id, id), eq(discoveries.state, "failed")) : eq(discoveries.state, "failed"));
  await audit(user.id, "retry_discoveries", "discovery", id ? String(id) : "all-failed");
  redirect("/admin/pipeline?retried=1");
}

// ---------- reference data ----------

const OrgForm = z.object({
  name: z.string().trim().min(2).max(200),
  shortName: optText(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, "Slug: lowercase letters, digits and dashes").optional().or(z.literal("")),
  level: z.enum(["central", "state", "ut", "psu", "autonomous"]),
  stateId: optId,
  sectorId: optId,
  website: optUrl,
  officialDomains: z.string().max(1000).default(""),
  description: optText(2000),
  notes: optText(2000),
  active: z.string().optional().transform((v) => v === "on"),
});

export async function saveOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const parsed = OrgForm.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { slug, officialDomains, ...v } = parsed.data;
  const domains = officialDomains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  const db = await getDb();
  try {
    if (id) {
      await db.update(organizations).set({ ...v, officialDomains: domains, ...(slug ? { slug } : {}), updatedAt: new Date() }).where(eq(organizations.id, id));
    } else {
      await db.insert(organizations).values({ ...v, officialDomains: domains, slug: slug || slugify(v.shortName ?? v.name, 60), referenceSource: "Admin" });
    }
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { error: "That slug is already used." };
    throw e;
  }
  await audit(user.id, id ? "update" : "create", "organization", id ? String(id) : v.name);
  revalidatePath("/", "layout");
  return { ok: true, message: "Organisation saved." };
}

export async function saveSector(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/),
      description: optText(500),
      keywords: z.string().max(2000).default(""),
      sort: z.coerce.number().int().min(0).max(1000).default(0),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = { ...parsed.data, keywords: parsed.data.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) };
  const db = await getDb();
  try {
    if (id) await db.update(sectors).set(v).where(eq(sectors.id, id));
    else await db.insert(sectors).values(v);
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { error: "That slug is already used." };
    throw e;
  }
  await audit(user.id, id ? "update" : "create", "sector", id ? String(id) : v.slug);
  revalidatePath("/", "layout");
  return { ok: true, message: "Sector saved." };
}

export async function saveQualification(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/),
      level: z.coerce.number().int().min(0).max(20),
      patterns: z.string().max(3000).default(""),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const patterns = compileCheck(parsed.data.patterns);
  if (!Array.isArray(patterns)) return patterns;
  const db = await getDb();
  const v = { ...parsed.data, patterns };
  try {
    if (id) await db.update(qualifications).set(v).where(eq(qualifications.id, id));
    else await db.insert(qualifications).values(v);
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { error: "That slug is already used." };
    throw e;
  }
  await audit(user.id, id ? "update" : "create", "qualification", id ? String(id) : v.slug);
  revalidatePath("/", "layout");
  return { ok: true, message: "Qualification saved." };
}

export async function saveState(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const parsed = z
    .object({ highlights: optText(500), needsLinkCheck: z.string().optional().transform((v) => v === "on") })
    .safeParse(formObject(fd));
  if (!parsed.success || !id) return { error: "Invalid input." };
  const db = await getDb();
  await db.update(states).set(parsed.data).where(eq(states.id, id));
  await audit(user.id, "update", "state", String(id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

// ---------- users ----------

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(200),
      name: z.string().trim().min(2).max(120),
      role: z.enum(["admin", "editor"]),
      password: z.string().min(12, "Password must be at least 12 characters").max(200),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  try {
    await db.insert(adminUsers).values({ email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) });
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { error: "That email already has an account." };
    throw e;
  }
  await audit(user.id, "create", "admin_user", parsed.data.email, { role: parsed.data.role });
  revalidatePath("/admin/users");
  return { ok: true, message: `Account created for ${parsed.data.email}.` };
}

export async function toggleUser(fd: FormData) {
  const user = await requireAdmin("admin");
  const id = Number(fd.get("id"));
  if (id && id !== user.id) {
    const db = await getDb();
    const [u] = await db.select({ active: adminUsers.active }).from(adminUsers).where(eq(adminUsers.id, id));
    if (u) {
      await db.update(adminUsers).set({ active: !u.active }).where(eq(adminUsers.id, id));
      await audit(user.id, u.active ? "deactivate" : "activate", "admin_user", String(id));
    }
  }
  redirect("/admin/users");
}
