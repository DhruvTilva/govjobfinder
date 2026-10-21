"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { exams, NOTICE_KINDS, organizations } from "@/db/schema";
import { audit, requireAdmin } from "@/lib/auth";
import { safeHref } from "@/lib/url";
import { slugify } from "@/lib/text";
import {
  CONTENT_ACTIONS,
  createContent,
  deleteContent,
  duplicateContent,
  saveSiteSetting,
  setContentStatus,
  updateContent,
  validateContent,
  type ContentAction,
  type ContentInput,
  type DuplicateHit,
  type PopularSearch,
} from "@/lib/content";

export type ContentState = { ok?: boolean; error?: string; message?: string; duplicates?: DuplicateHit[] } | undefined;

const text = (max = 4000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const int = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable())
    .optional();
const date = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable())
  .optional();
const url = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || safeHref(v) !== null, "Must be an http(s) URL")
  .nullable()
  .optional();
const id = int(1, 2_147_483_647);
const check = z.string().optional().transform((v) => v === "on");

const ContentForm = z.object({
  title: z.string().trim().min(5, "Title is too short").max(300),
  kind: z.enum(NOTICE_KINDS),
  summary: text(1500),
  organizationId: id,
  stateId: id,
  sectorId: id,
  parentId: id,
  isCentral: check,
  advtNo: text(120),
  totalPosts: int(1, 500000),
  postNames: text(1000),
  location: text(300),
  qualificationText: text(),
  experienceText: text(),
  ageMin: int(14, 70),
  ageMax: int(14, 70),
  ageText: text(1000),
  feeText: text(1500),
  salaryText: text(1500),
  jobType: z.enum(["permanent", "contract", "apprentice", "deputation", "unknown"]).default("unknown"),
  selectionText: text(),
  howToApply: text(),
  documentsText: text(),
  noticeDate: date,
  applyStart: date,
  applyEnd: date,
  examDate: date,
  notificationUrl: url,
  applyUrl: url,
  keywords: text(500),
  pinned: check,
  attachmentId: id,
});

function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) o[k] = v;
  return o;
}

function importantDates(fd: FormData) {
  const labels = fd.getAll("dateLabel").map(String);
  const dates = fd.getAll("dateValue").map(String);
  const out: { label: string; date: string | null; text: null }[] = [];
  labels.forEach((label, i) => {
    const l = label.trim().slice(0, 120);
    const d = (dates[i] ?? "").trim();
    if (l && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.push({ label: l, date: d, text: null });
  });
  return out.slice(0, 15);
}

function parse(fd: FormData): { input: ContentInput } | { error: string } {
  const parsed = ContentForm.safeParse(formObject(fd));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i.path.join(".") || "Input"}: ${i.message}` };
  }
  const input: ContentInput = {
    ...parsed.data,
    importantDates: importantDates(fd),
    qualIds: fd.getAll("qualIds").map(Number).filter((n) => Number.isInteger(n) && n > 0),
  };
  const invalid = validateContent(input);
  return invalid ? { error: invalid } : { input };
}

function revalidatePublic() {
  revalidatePath("/", "layout");
}

/** Create or edit. intent: "draft" (save without publishing) or "publish". */
export async function saveContent(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireAdmin();
  const p = parse(fd);
  if ("error" in p) return { error: p.error };
  const noticeId = Number(fd.get("id")) || null;
  const intent = fd.get("intent") === "publish" ? "publish" : "draft";
  const db = await getDb();

  if (!noticeId) {
    const res = await createContent(db, user, p.input, { publish: intent === "publish", allowDuplicate: fd.get("allowDuplicate") === "on" });
    if ("duplicates" in res) {
      return { error: "This looks like a notice that already exists. Open it below, or tick “Create anyway” if it is a different notification.", duplicates: res.duplicates };
    }
    await audit(user.id, intent === "publish" ? "create_publish" : "create_draft", "notice", String(res.id), { title: p.input.title, kind: p.input.kind });
    if (intent === "publish") revalidatePublic();
    redirect(`/bigboss/content/${res.id}?saved=${intent}`);
  }

  const loaded = Number(fd.get("loadedUpdatedAt"));
  const res = await updateContent(db, user, noticeId, p.input, loaded ? new Date(loaded) : null);
  if ("notFound" in res) return { error: "Notice not found (it may have been deleted)." };
  if ("conflict" in res) return { error: `Someone else (an editor or the pipeline) changed this notice at ${res.conflict.toISOString()}. Reload to see their change; your edits were not saved.` };
  if (res.changed.length) await audit(user.id, "update", "notice", String(noticeId), { fields: res.changed });
  if (intent === "publish") {
    await setContentStatus(db, user, [noticeId], "publish");
    await audit(user.id, "publish", "notice", String(noticeId));
  }
  revalidatePublic();
  return { ok: true, message: intent === "publish" ? `Saved and published${res.changed.length ? ` (${res.changed.length} change(s))` : ""}.` : res.changed.length ? `Saved ${res.changed.length} change(s).` : "No changes." };
}

export async function contentStatusAction(fd: FormData) {
  const user = await requireAdmin();
  const noticeId = Number(fd.get("id"));
  const action = String(fd.get("action")) as ContentAction;
  if (!noticeId || !CONTENT_ACTIONS.includes(action)) redirect("/bigboss/content");
  const n = await setContentStatus(await getDb(), user, [noticeId], action);
  if (n) await audit(user.id, action, "notice", String(noticeId));
  revalidatePublic();
  redirect(`/bigboss/content/${noticeId}?status=${action}`);
}

/** Deleting needs the admin role and a typed confirmation. */
export async function deleteContentAction(fd: FormData) {
  const user = await requireAdmin("admin");
  const noticeId = Number(fd.get("id"));
  if (!noticeId || fd.get("confirm") !== "DELETE") redirect(`/bigboss/content/${noticeId}?error=confirm`);
  const deleted = await deleteContent(await getDb(), [noticeId]);
  if (deleted.length) await audit(user.id, "delete", "notice", String(noticeId), { title: deleted[0].title });
  revalidatePublic();
  redirect("/bigboss/content?deleted=1");
}

export async function duplicateContentAction(fd: FormData) {
  const user = await requireAdmin();
  const noticeId = Number(fd.get("id"));
  const copy = noticeId ? await duplicateContent(await getDb(), user, noticeId) : null;
  if (!copy) redirect("/bigboss/content");
  await audit(user.id, "duplicate", "notice", String(copy), { from: noticeId });
  redirect(`/bigboss/content/${copy}?saved=duplicate`);
}

export async function bulkContentAction(fd: FormData) {
  const action = String(fd.get("action"));
  const user = await requireAdmin(action === "delete" ? "admin" : "editor");
  const ids = fd.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  const raw = String(fd.get("back") ?? "/bigboss/content");
  const back = raw.startsWith("/bigboss/content") ? raw : "/bigboss/content";
  const sep = back.includes("?") ? "&" : "?";
  if (!ids.length) redirect(`${back}${sep}bulk=none`);
  const db = await getDb();
  let n = 0;
  if (action === "delete") {
    if (fd.get("confirm") !== "DELETE") redirect(`${back}${sep}bulk=confirm`);
    n = (await deleteContent(db, ids)).length;
  } else if ((CONTENT_ACTIONS as readonly string[]).includes(action)) {
    n = await setContentStatus(db, user, ids, action as ContentAction);
  } else {
    redirect(back);
  }
  await audit(user.id, `bulk_${action}`, "notice", ids.join(","), { changed: n });
  revalidatePublic();
  redirect(`${back}${sep}bulk=${action}&n=${n}`);
}

// ---------- site settings ----------

export async function saveSettingsAction(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireAdmin();
  const db = await getDb();
  const popular: PopularSearch[] = [];
  const en = fd.getAll("popEn").map(String);
  const hi = fd.getAll("popHi").map(String);
  const q = fd.getAll("popQ").map(String);
  en.forEach((label, i) => {
    const e = label.trim().slice(0, 40);
    const query = (q[i] ?? "").trim().slice(0, 80) || e;
    if (e) popular.push({ en: e, hi: (hi[i] ?? "").trim().slice(0, 40) || e, q: query });
  });
  const bannerText = String(fd.get("bannerText") ?? "").trim().slice(0, 300);
  const bannerUrl = String(fd.get("bannerUrl") ?? "").trim();
  if (bannerUrl && !(bannerUrl.startsWith("/") && !bannerUrl.startsWith("//")) && !safeHref(bannerUrl)) return { error: "Banner link must be a site path like /jobs or an http(s) URL." };
  const announcement = bannerText
    ? {
        active: fd.get("bannerActive") === "on",
        text: bannerText,
        textHi: String(fd.get("bannerTextHi") ?? "").trim().slice(0, 300) || undefined,
        url: bannerUrl || undefined,
        tone: fd.get("bannerTone") === "urgent" ? ("urgent" as const) : ("info" as const),
      }
    : null;
  await saveSiteSetting(db, user.id, "popular_searches", popular.slice(0, 16));
  await saveSiteSetting(db, user.id, "announcement", announcement);
  await audit(user.id, "update", "site_settings", null, { popular: popular.length, banner: announcement?.active ?? false });
  revalidatePublic();
  return { ok: true, message: "Website settings saved." };
}

// ---------- exam directory ----------

const ExamForm = z.object({
  name: z.string().trim().min(3).max(200),
  group: z.string().trim().min(2).max(100),
  rank: int(1, 1000),
  organizationId: id,
  recruitingBody: text(200),
  officialUrl: url,
  typicalWindow: text(200),
  focusAreas: text(500),
  difficulty: text(50),
  notes: text(1000),
  active: check,
});

export async function saveExamAction(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireAdmin();
  const parsed = ExamForm.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const examId = Number(fd.get("id")) || null;
  const v = parsed.data;
  if (v.organizationId) {
    const [o] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, v.organizationId));
    if (!o) return { error: "Unknown organisation." };
  }
  if (examId) {
    await db.update(exams).set(v).where(eq(exams.id, examId));
    await audit(user.id, "update", "exam", String(examId), { name: v.name });
  } else {
    const [created] = await db
      .insert(exams)
      .values({ ...v, slug: slugify(v.name, 80) })
      .onConflictDoNothing()
      .returning({ id: exams.id });
    if (!created) return { error: "An exam with this name already exists." };
    await audit(user.id, "create", "exam", String(created.id), { name: v.name });
  }
  revalidatePath("/exams");
  return { ok: true, message: "Exam saved." };
}

export async function deleteExamAction(fd: FormData) {
  const user = await requireAdmin("admin");
  const examId = Number(fd.get("id"));
  if (examId && fd.get("confirm") === "on") {
    await (await getDb()).delete(exams).where(eq(exams.id, examId));
    await audit(user.id, "delete", "exam", String(examId));
    revalidatePath("/exams");
  }
  redirect("/bigboss/content/exams");
}
