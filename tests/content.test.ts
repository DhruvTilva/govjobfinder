import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.ANTHROPIC_API_KEY = "";

const { getDb, closeDb } = await import("@/db/client");
const { runMigrations } = await import("@/db/migrate");
const { seedReferenceData } = await import("@/db/seed");
const schema = await import("@/db/schema");
const content = await import("@/lib/content");
const queries = await import("@/lib/queries");
const storage = await import("@/lib/storage");
const { suggestFromText } = await import("@/lib/content-suggest");
const { processDiscovery } = await import("@/pipeline/process");
const { PoliteFetcher } = await import("@/pipeline/polite");
const { sha256 } = await import("@/lib/text");
const { addDays, todayIST } = await import("@/pipeline/dates");
type FetchedDocument = import("@/pipeline/documents").FetchedDocument;

const { notices, noticeRevisions, organizations, sources, states, sectors, qualifications, adminUsers, discoveries } = schema;
type DB = Awaited<ReturnType<typeof getDb>>;

let db: DB;
let actor: { id: number; email: string };
let ssc: { id: number; sourceId: number; url: string; allowedDomains: string[]; level: string; officialDomains: string[] };
let biharId: number;
let engineeringId: number;
const today = todayIST();
const fmt = (iso: string) => iso.split("-").reverse().join("/");

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  await seedReferenceData(db);
  const [u] = await db.insert(adminUsers).values({ email: "editor@test.local", name: "Editor", passwordHash: "x", role: "admin" }).returning();
  actor = { id: u.id, email: u.email };
  const [row] = await db.select({ s: sources, o: organizations }).from(sources).innerJoin(organizations, eq(sources.organizationId, organizations.id)).where(eq(organizations.slug, "ssc"));
  ssc = { id: row.o.id, sourceId: row.s.id, url: row.s.url, allowedDomains: row.s.allowedDomains, level: row.o.level, officialDomains: row.o.officialDomains };
  biharId = (await db.select().from(states).where(eq(states.slug, "bihar")))[0].id;
  engineeringId = (await db.select().from(sectors).where(eq(sectors.slug, "engineering")))[0].id;
});

afterAll(async () => {
  await closeDb();
});

const job = (over: Partial<import("@/lib/content").ContentInput> = {}): import("@/lib/content").ContentInput => ({
  title: "Recruitment of Junior Engineer (Civil) 2026",
  kind: "recruitment",
  organizationId: ssc.id,
  stateId: biharId,
  sectorId: engineeringId,
  advtNo: "JE/CIVIL/07/2026",
  totalPosts: 120,
  applyStart: addDays(today, -2),
  applyEnd: addDays(today, 5),
  qualificationText: "Diploma in Civil Engineering",
  feeText: "Rs 100",
  notificationUrl: "https://ssc.gov.in/notices/je-civil-07-2026.pdf",
  applyUrl: "https://ssc.gov.in/apply",
  keywords: "group b, technical",
  importantDates: [{ label: "Exam city slip", date: addDays(today, 20), text: null }],
  ...over,
});

let jobId: number;

describe("content manager: create, publish, edit, unpublish, archive", () => {
  it("saves a manual job as a draft that is not public", async () => {
    const res = await content.createContent(db, actor, job());
    expect("id" in res).toBe(true);
    jobId = (res as { id: number }).id;
    const [n] = await db.select().from(notices).where(eq(notices.id, jobId));
    expect(n).toMatchObject({ status: "draft", verification: "manual", dedupeKey: null, applyEnd: addDays(today, 5) });
    expect(n.fieldSources.applyEnd).toBe("admin");
    expect((await queries.listNotices({}, "recruitment")).items.map((i) => i.id)).not.toContain(jobId);
    expect(await queries.getNotice(n.slug)).toBeNull();
  });

  it("publishes it into Latest Jobs, Closing Soon, state/sector/keyword filters and its detail page", async () => {
    expect(await content.setContentStatus(db, actor, [jobId], "publish")).toBe(1);
    const [n] = await db.select().from(notices).where(eq(notices.id, jobId));
    expect(n).toMatchObject({ status: "published", verification: "manual" });
    expect(n.publishedAt).not.toBeNull();
    const ids = async (f: import("@/lib/queries").Filters) => (await queries.listNotices(f, "recruitment")).items.map((i) => i.id);
    expect(await ids({})).toContain(jobId);
    expect(await ids({ status: "closing" })).toContain(jobId);
    expect(await ids({ state: "bihar" })).toContain(jobId);
    expect(await ids({ state: "punjab" })).not.toContain(jobId);
    expect(await ids({ sector: "engineering" })).toContain(jobId);
    expect(await ids({ org: "ssc" })).toContain(jobId);
    expect(await ids({ q: "technical" })).toContain(jobId);
    const page = await queries.getNotice(n.slug);
    expect(page?.n).toMatchObject({ title: job().title, notificationUrl: job().notificationUrl, applyUrl: job().applyUrl, totalPosts: 120 });
    expect(page?.n.importantDates).toEqual([{ label: "Exam city slip", date: addDays(today, 20), text: null }]);
  });

  it("pinned notices come first in the default order", async () => {
    const before = (await queries.listNotices({}, "recruitment", 50)).items;
    const other = await content.createContent(db, actor, job({ title: "Recruitment of Stenographer Grade C 2026", advtNo: "STENO/1/2026", notificationUrl: "https://ssc.gov.in/steno.pdf" }), { publish: true });
    const otherId = (other as { id: number }).id;
    expect((await queries.listNotices({}, "recruitment", 50)).items[0].id).toBe(otherId);
    const [cur] = await db.select().from(notices).where(eq(notices.id, jobId));
    await content.updateContent(db, actor, jobId, { ...job(), pinned: true }, cur.updatedAt);
    expect((await queries.listNotices({}, "recruitment", 50)).items[0].id).toBe(jobId);
    expect(before.length).toBeGreaterThan(0);
  });

  it("edits a published notice, updates the public page and refuses a stale save", async () => {
    const [cur] = await db.select().from(notices).where(eq(notices.id, jobId));
    const res = await content.updateContent(db, actor, jobId, { ...job(), pinned: true, title: "Recruitment of Junior Engineer (Civil) 2026 — revised", totalPosts: 150 }, cur.updatedAt);
    expect(res).toMatchObject({ ok: true });
    expect((res as { changed: string[] }).changed).toEqual(expect.arrayContaining(["title", "totalPosts"]));
    const page = await queries.getNotice(cur.slug);
    expect(page?.n).toMatchObject({ title: "Recruitment of Junior Engineer (Civil) 2026 — revised", totalPosts: 150 });
    // Saving again from the old version (someone else saved in between) is refused.
    const stale = await content.updateContent(db, actor, jobId, { ...job(), title: "Overwrite attempt" }, cur.updatedAt);
    expect("conflict" in stale).toBe(true);
    expect((await db.select().from(notices).where(eq(notices.id, jobId)))[0].title).toContain("revised");
  });

  it("unpublish returns a manual notice to draft; archive hides it everywhere", async () => {
    await content.setContentStatus(db, actor, [jobId], "unpublish");
    let [n] = await db.select().from(notices).where(eq(notices.id, jobId));
    expect(n).toMatchObject({ status: "draft", verification: "manual" });
    expect(await queries.getNotice(n.slug)).toBeNull();
    await content.setContentStatus(db, actor, [jobId], "archive");
    [n] = await db.select().from(notices).where(eq(notices.id, jobId));
    expect(n.status).toBe("archived");
    expect((await queries.listNotices({ status: "closed" }, "recruitment")).items.map((i) => i.id)).not.toContain(jobId);
    const revs = await db.select().from(noticeRevisions).where(eq(noticeRevisions.noticeId, jobId));
    expect(revs.map((r) => r.changeType)).toEqual(expect.arrayContaining(["created", "status", "updated"]));
  });
});

describe("content types", () => {
  it("admit cards, results, answer keys and admissions land in their own sections without job-only fields", async () => {
    const cases: [import("@/db/schema").NoticeKind, string][] = [
      ["admit_card", "SSC JE 2026 Admit Card and City Intimation Slip"],
      ["result", "SSC JE 2026 Paper I Result"],
      ["answer_key", "SSC JE 2026 Tentative Answer Key"],
      ["admission", "NIOS D.El.Ed Admission 2027"],
    ];
    for (const [kind, title] of cases) {
      const res = await content.createContent(db, actor, { ...job({ title, kind, notificationUrl: `https://ssc.gov.in/${kind}.pdf`, advtNo: null }) }, { publish: true });
      const id = (res as { id: number }).id;
      const [n] = await db.select().from(notices).where(eq(notices.id, id));
      expect(n).toMatchObject({ kind, status: "published", applyEnd: null, totalPosts: null, feeText: null });
      expect((await queries.listNotices({ kind }, kind)).items.map((i) => i.id)).toContain(id);
      expect((await queries.listNotices({}, "recruitment")).items.map((i) => i.id)).not.toContain(id);
    }
  });
});

describe("duplicates", () => {
  it("flags the same official URL or advertisement, and allows an explicit override", async () => {
    const res = await content.createContent(db, actor, job({ title: "Junior Engineer Civil recruitment (copy)", advtNo: null }));
    expect("duplicates" in res).toBe(true);
    expect((res as { duplicates: { reason: string }[] }).duplicates[0].reason).toBe("same official notification URL");
    const byAdvt = await content.createContent(db, actor, job({ notificationUrl: null }));
    expect((byAdvt as { duplicates: { reason: string }[] }).duplicates.map((d) => d.reason)).toContain("same organisation and advertisement number");
    const forced = await content.createContent(db, actor, job({ notificationUrl: null, title: "Different notice entirely 2026" }), { allowDuplicate: true });
    expect("id" in forced).toBe(true);
  });

  it("the pipeline treats a manual notice's official PDF as already stored", async () => {
    const text = "Staff Selection Commission\nNotice No. MAN/DUP/2026\nRecruitment of Lab Assistant\nLast date for receipt of online applications: " + fmt(addDays(today, 15)) + "\n" + "Details. ".repeat(40);
    const url = "https://ssc.gov.in/notices/lab-assistant.pdf";
    await content.createContent(db, actor, job({ title: "Recruitment of Lab Assistant 2026", advtNo: "MAN/DUP/2026", notificationUrl: url }), { publish: true });
    const outcome = await runPipelineOn(url, "Recruitment of Lab Assistant 2026", text);
    expect(outcome).toBe("duplicate");
  });
});

async function runPipelineOn(url: string, linkText: string, text: string) {
  const [d] = await db.insert(discoveries).values({ sourceId: ssc.sourceId, url, linkText, fingerprint: sha256(url + Math.random()) }).returning();
  const fetchDoc = async (u: string): Promise<FetchedDocument> => ({ url: u, finalUrl: u, contentType: "pdf", hash: sha256(text + u), text, pdfLinks: [], applyLinks: [] });
  const taxonomy = {
    sectors: await db.select({ id: sectors.id, keywords: sectors.keywords }).from(sectors),
    qualifications: await db.select({ id: qualifications.id, patterns: qualifications.patterns }).from(qualifications),
  };
  const src = { id: ssc.sourceId, url: ssc.url, trust: "trusted" as const, allowedDomains: ssc.allowedDomains, config: {}, organization: { id: ssc.id, level: ssc.level, stateId: null, sectorId: null, officialDomains: ssc.officialDomains } };
  return processDiscovery({ db, fetcher: new PoliteFetcher(0), taxonomy, log: async () => {}, fetchDoc }, d, src);
}

describe("automated ingestion keeps editor corrections", () => {
  it("does not overwrite an edited deadline when the same advertisement is seen again, and records a suggestion", async () => {
    const end = addDays(today, 30);
    const doc = (date: string) => `Staff Selection Commission\nAdvt No. AUTO/KEEP/2026\nRecruitment of Data Entry Operator\nLast date for receipt of online applications: ${fmt(date)}\nAge Limit: 18 to 27 years\n` + "Information. ".repeat(40);
    expect(await runPipelineOn("https://ssc.gov.in/notices/deo-2026.pdf", "Recruitment of Data Entry Operator 2026", doc(end))).toBe("published");
    const [auto] = await db.select().from(notices).where(eq(notices.advtNo, "AUTO/KEEP/2026"));
    expect(auto.verification).toBe("auto");
    // Editor corrects the deadline.
    const corrected = addDays(today, 40);
    const input = { ...Object.fromEntries(Object.entries(auto).filter(([k]) => k in job())), title: auto.title, kind: auto.kind, applyEnd: corrected } as import("@/lib/content").ContentInput;
    expect(await content.updateContent(db, actor, auto.id, input, auto.updatedAt)).toMatchObject({ ok: true });
    // The source page later lists another copy with a different date.
    expect(await runPipelineOn("https://ssc.gov.in/notices/deo-2026-v2.pdf", "Recruitment of Data Entry Operator 2026 - detailed notice", doc(addDays(today, 33)))).toBe("duplicate");
    const [after] = await db.select().from(notices).where(eq(notices.id, auto.id));
    expect(after.applyEnd).toBe(corrected);
    expect(after.fieldSources.applyEnd).toBe("admin");
    const sugg = await db.select().from(noticeRevisions).where(and(eq(noticeRevisions.noticeId, auto.id), eq(noticeRevisions.changeType, "pipeline_suggestion")));
    expect(sugg).toHaveLength(1);
    expect(sugg[0].diff.applyEnd).toEqual([corrected, addDays(today, 33)]);
  });

  it("does not apply a deadline extension over a deadline the editor set", async () => {
    const [n] = await db.select().from(notices).where(eq(notices.advtNo, "AUTO/KEEP/2026"));
    const ext = addDays(today, 60);
    await runPipelineOn("https://ssc.gov.in/notices/deo-extension.pdf", "Extension of last date for Data Entry Operator 2026", `Advt No. AUTO/KEEP/2026\nThe last date for receipt of online applications is extended to ${fmt(ext)}.`);
    const [after] = await db.select().from(notices).where(eq(notices.id, n.id));
    expect(after.applyEnd).toBe(n.applyEnd);
    const sugg = await db.select().from(noticeRevisions).where(and(eq(noticeRevisions.noticeId, n.id), eq(noticeRevisions.changeType, "pipeline_suggestion")));
    expect(sugg.some((s) => (s.diff.applyEnd as unknown[])?.[1] === ext)).toBe(true);
  });
});

describe("delete and duplicate", () => {
  it("duplicates into a draft and deletes permanently", async () => {
    const copy = await content.duplicateContent(db, actor, jobId);
    const [c] = await db.select().from(notices).where(eq(notices.id, copy!));
    expect(c).toMatchObject({ status: "draft", verification: "manual", pinned: false });
    expect(c.title).toContain("(copy)");
    const deleted = await content.deleteContent(db, [copy!]);
    expect(deleted).toHaveLength(1);
    expect(await db.select().from(notices).where(eq(notices.id, copy!))).toHaveLength(0);
  });
});

describe("uploads", () => {
  const pdf = (body = "%PDF-1.4\n% test\n") => new TextEncoder().encode(body);
  it("accepts only real PDFs within the size limit and sanitises names", () => {
    expect(() => storage.validatePdf(pdf(), "notice.pdf")).not.toThrow();
    expect(() => storage.validatePdf(new TextEncoder().encode("<html>not a pdf</html>"), "notice.pdf")).toThrow(/not a PDF/);
    expect(() => storage.validatePdf(pdf(), "notice.exe")).toThrow(/\.pdf/);
    expect(() => storage.validatePdf(new Uint8Array(0), "a.pdf")).toThrow(/empty/);
    expect(() => storage.validatePdf(new Uint8Array(storage.MAX_UPLOAD_BYTES + 1).fill(37), "a.pdf")).toThrow(/larger/);
    expect(storage.safeFileName("../../etc/Advt No. 07 (2026) भर्ती.PDF")).toBe("Advt-No.-07-2026.pdf");
    expect(storage.safeFileName("…")).toBe("notice.pdf");
  });
  it("stores in the database and reads back the same bytes", async () => {
    const bytes = pdf("%PDF-1.4\nhello\n");
    const saved = await storage.saveUpload(db, { bytes, name: "Notice.pdf", userId: actor.id });
    const back = await storage.readUpload(db, saved.id);
    expect(back?.fileName).toBe("Notice.pdf");
    expect(Buffer.from(back!.bytes).toString()).toBe("%PDF-1.4\nhello\n");
    expect(storage.uploadPath(saved)).toBe(`/files/${saved.id}/Notice.pdf`);
  });
  it("suggests fields from notice text without inventing missing ones", () => {
    const s = suggestFromText(`GOVERNMENT OF BIHAR\nRecruitment of Assistant Engineer (Civil) 2026\nAdvt. No. 05/2026\nTotal Posts: 45\nLast date for receipt of online application: ${fmt(addDays(today, 12))}\nAge Limit: 21 to 37 years\n` + "x ".repeat(120));
    expect(s).toMatchObject({ title: "Recruitment of Assistant Engineer (Civil) 2026", kind: "recruitment", advtNo: "05/2026", totalPosts: 45, applyEnd: addDays(today, 12), ageMin: 21, ageMax: 37 });
    expect(s.feeText).toBeUndefined();
  });
});

describe("site settings", () => {
  it("falls back to the default popular searches and saves edits", async () => {
    expect((await content.getSiteSettings(db)).popularSearches[0].q).toBe("SSC");
    await content.saveSiteSetting(db, actor.id, "popular_searches", [{ en: "Agniveer", hi: "अग्निवीर", q: "Agniveer" }]);
    await content.saveSiteSetting(db, actor.id, "announcement", { active: true, text: "Site maintenance tonight", tone: "info" });
    const s = await content.getSiteSettings(db);
    expect(s.popularSearches).toEqual([{ en: "Agniveer", hi: "अग्निवीर", q: "Agniveer" }]);
    expect(s.announcement).toMatchObject({ active: true, text: "Site maintenance tonight" });
  });
});

describe("exam directory seed", () => {
  it("loads the technical list and the national list without slug collisions, each linked to a body and website", async () => {
    const { EXAMS } = await import("@/db/seed/exams");
    const { NATIONAL_EXAMS } = await import("@/db/seed/exams-national");
    const rows = await db.select().from(schema.exams);
    expect(rows.length).toBe(EXAMS.length + NATIONAL_EXAMS.length);
    const national = rows.filter((r) => r.rank != null && r.rank > 100);
    expect(national).toHaveLength(NATIONAL_EXAMS.length);
    for (const r of national) {
      expect(r.recruitingBody, r.name).toBeTruthy();
      // Two bodies have no working official site to link (checked 2026-10-22).
      const noLink = ["Territorial Army Officer", "WBHRB (West Bengal Health Recruitment Board)"];
      expect(r.officialUrl ?? (noLink.includes(r.name) ? "none" : null), r.name).toBeTruthy();
    }
    const linked = national.filter((r) => r.organizationId != null).length;
    expect(linked).toBe(NATIONAL_EXAMS.filter((e) => e.org).length);
  });
});
