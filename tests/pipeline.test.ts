import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.ANTHROPIC_API_KEY = "";

const { getDb, closeDb } = await import("@/db/client");
const { runMigrations } = await import("@/db/migrate");
const { seedReferenceData } = await import("@/db/seed");
const schema = await import("@/db/schema");
const { processDiscovery, closeExpired } = await import("@/pipeline/process");
const { PoliteFetcher } = await import("@/pipeline/polite");
const { sha256 } = await import("@/lib/text");
const { normalizeUrl } = await import("@/lib/url");
const { addDays, todayIST } = await import("@/pipeline/dates");
type FetchedDocument = import("@/pipeline/documents").FetchedDocument;

const { discoveries, notices, noticeRevisions, sources, organizations, sectors, qualifications, noticeQualifications } = schema;
type DB = Awaited<ReturnType<typeof getDb>>;

let db: DB;
let src: Parameters<typeof processDiscovery>[2];
const today = todayIST();
const fmt = (iso: string) => iso.split("-").reverse().join("/"); // dd/mm/yyyy

/** Fake documents keyed by URL. */
const docs = new Map<string, string>();
const fetchDoc = async (url: string): Promise<FetchedDocument> => {
  const text = docs.get(url);
  if (text == null) throw new Error("HTTP 404");
  return { url, finalUrl: url, contentType: "pdf", hash: sha256(text), text, pdfLinks: [], applyLinks: [] };
};

let seq = 0;
async function discover(url: string, linkText: string, sourceId = src.id) {
  const [row] = await db
    .insert(discoveries)
    .values({ sourceId, url, linkText, fingerprint: sha256(normalizeUrl(url)) + String(seq++) })
    .returning();
  return row;
}

async function run(url: string, linkText: string, body?: string) {
  if (body != null) docs.set(url, body);
  const d = await discover(url, linkText);
  const taxonomy = {
    sectors: await db.select({ id: sectors.id, keywords: sectors.keywords }).from(sectors),
    qualifications: await db.select({ id: qualifications.id, patterns: qualifications.patterns }).from(qualifications),
  };
  const outcome = await processDiscovery({ db, fetcher: new PoliteFetcher(0), taxonomy, log: async () => {}, fetchDoc }, d, src);
  const [after] = await db.select().from(discoveries).where(eq(discoveries.id, d.id));
  return { outcome, discovery: after };
}

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  await seedReferenceData(db);
  const [row] = await db
    .select({ s: sources, o: organizations })
    .from(sources)
    .innerJoin(organizations, eq(sources.organizationId, organizations.id))
    .where(eq(organizations.slug, "ssc"));
  src = {
    id: row.s.id,
    url: row.s.url,
    trust: "trusted",
    allowedDomains: row.s.allowedDomains,
    config: {},
    organization: { id: row.o.id, level: row.o.level, stateId: row.o.stateId, sectorId: row.o.sectorId, officialDomains: row.o.officialDomains },
  };
});

afterAll(async () => {
  await closeDb();
});

const end = addDays(today, 20);
const NOTICE = `Staff Selection Commission
Notice No. HQ-PPII03/1/2026
Combined Graduate Level Examination 2026
Total Posts: 1500
Last date for receipt of online applications: ${fmt(end)}
Age Limit: 18 to 32 years
Essential Qualification: Bachelor's Degree from a recognised University.
Application Fee: Rs 100/- (Women, SC, ST exempted)`;

describe("processDiscovery", () => {
  it("auto-publishes a complete notice from a trusted official source", async () => {
    const { outcome, discovery } = await run("https://ssc.gov.in/notices/cgl-2026.pdf", "Recruitment notice: Combined Graduate Level Examination 2026", NOTICE);
    expect(outcome).toBe("published");
    const [n] = await db.select().from(notices).where(eq(notices.id, discovery.noticeId!));
    expect(n).toMatchObject({ status: "published", kind: "recruitment", applyEnd: end, totalPosts: 1500, ageMin: 18, ageMax: 32, isCentral: true, verification: "auto" });
    expect(n.fieldSources.applyEnd).toBe("notice");
    expect(n.publishedAt).not.toBeNull();
    const quals = await db.select().from(noticeQualifications).where(eq(noticeQualifications.noticeId, n.id));
    expect(quals.length).toBeGreaterThan(0);
  });

  it("does not create a second notice for the same document under another link", async () => {
    const { outcome } = await run("https://ssc.gov.in/notices/cgl-2026-copy.pdf", "Combined Graduate Level Examination 2026 notice", NOTICE);
    expect(outcome).toBe("duplicate");
    const all = await db.select({ id: notices.id }).from(notices).where(eq(notices.advtNo, "HQ-PPII03/1/2026"));
    expect(all).toHaveLength(1);
  });

  it("applies a deadline extension to the original notice and records the change", async () => {
    const newEnd = addDays(today, 35);
    const { outcome, discovery } = await run(
      "https://ssc.gov.in/notices/cgl-extension.pdf",
      "Extension of last date for CGL Examination 2026",
      `Notice No. HQ-PPII03/1/2026\nThe last date for receipt of online applications is extended to ${fmt(newEnd)}.`,
    );
    expect(outcome).toBe("amendment_applied");
    const [n] = await db.select().from(notices).where(eq(notices.id, discovery.noticeId!));
    expect(n.applyEnd).toBe(newEnd);
    expect(n.links.some((l) => l.url.endsWith("cgl-extension.pdf"))).toBe(true);
    const revs = await db.select().from(noticeRevisions).where(eq(noticeRevisions.noticeId, n.id));
    expect(revs.map((r) => r.changeType)).toContain("deadline_extended");
  });

  it("attaches an admit card to its recruitment and leaves application dates empty", async () => {
    const { outcome, discovery } = await run(
      "https://ssc.gov.in/notices/cgl-admit.pdf",
      "Admit Card for Combined Graduate Level Examination 2026",
      `Notice No. HQ-PPII03/1/2026\nAdmit cards can be downloaded till ${fmt(addDays(today, 5))}.\n` +
        "Candidates are advised to download their admit cards from the regional websites of the Commission and to report at the venue " +
        "with a valid photo identity card. No candidate will be allowed entry without the admit card.",
    );
    expect(outcome).toBe("published");
    const [n] = await db.select().from(notices).where(eq(notices.id, discovery.noticeId!));
    expect(n.kind).toBe("admit_card");
    expect(n.parentId).not.toBeNull();
    expect(n.applyEnd).toBeNull();
  });

  it("routes notices without a closing date to review with a reason", async () => {
    const { outcome, discovery } = await run("https://ssc.gov.in/notices/steno.pdf", "Recruitment of Stenographer Grade C and D 2026", "Stenographer posts. Details will follow.");
    expect(outcome).toBe("needs_review");
    const [n] = await db.select().from(notices).where(eq(notices.id, discovery.noticeId!));
    expect(n.reviewReasons).toContain("Closing date not found");
    expect(n.publishedAt).toBeNull();
  });

  it("routes links on non-official domains to review", async () => {
    const { outcome, discovery } = await run(
      "https://example-jobs.com/ssc-mts.pdf",
      "Recruitment of Multi Tasking Staff 2026",
      `Last date for online application: ${fmt(addDays(today, 10))}`,
    );
    expect(outcome).toBe("needs_review");
    const [n] = await db.select().from(notices).where(eq(notices.id, discovery.noticeId!));
    expect(n.reviewReasons).toContain("Link is not on an official domain");
  });

  it("archives notices that had already closed when discovered", async () => {
    const { outcome } = await run(
      "https://ssc.gov.in/notices/old.pdf",
      "Recruitment of Junior Engineer Examination 2025",
      `Last date for online application: ${fmt(addDays(today, -40))}`,
    );
    expect(outcome).toBe("archived");
  });

  it("ignores links that are not recruitment-related", async () => {
    const { outcome } = await run("https://ssc.gov.in/notices/office-hours.pdf", "Office timings during festival week", "text");
    expect(outcome).toBe("ignored");
  });

  it("schedules a retry when the document is temporarily unavailable", async () => {
    const { outcome, discovery } = await run("https://ssc.gov.in/notices/missing.pdf", "Recruitment of Selection Post Phase XIV 2026");
    expect(outcome).toBe("retry");
    expect(discovery.state).toBe("failed");
    expect(discovery.attempts).toBe(1);
    expect(discovery.nextAttemptAt).not.toBeNull();
  });
});

describe("reprocessing", () => {
  it("re-queues unedited review items and leaves editor-touched ones alone", async () => {
    const { requeueForReprocessing } = await import("@/pipeline/process");
    const a = await run("https://ssc.gov.in/notices/rq-a.pdf", "Recruitment of Draughtsman Grade III 2026", "Draughtsman posts. Details later.");
    const b = await run("https://ssc.gov.in/notices/rq-b.pdf", "Recruitment of Hindi Translator 2026", "Translator posts. Details later.");
    expect(a.outcome).toBe("needs_review");
    expect(b.outcome).toBe("needs_review");
    await db.insert(noticeRevisions).values({ noticeId: b.discovery.noticeId!, changeType: "updated", diff: {}, actor: "admin:editor@example.test" });

    const n = await requeueForReprocessing(db);
    expect(n).toBeGreaterThanOrEqual(1);
    const [da] = await db.select().from(discoveries).where(eq(discoveries.id, a.discovery.id));
    expect(da).toMatchObject({ state: "new", noticeId: null, attempts: 0 });
    expect(await db.select().from(notices).where(eq(notices.id, a.discovery.noticeId!))).toHaveLength(0);
    expect(await db.select().from(notices).where(eq(notices.id, b.discovery.noticeId!))).toHaveLength(1);
  });
});

describe("lifecycle", () => {
  it("closes published recruitments after their last date and is safe to rerun", async () => {
    const [n] = await db
      .insert(notices)
      .values({ slug: "expired-test", title: "Expired test recruitment", status: "published", applyEnd: addDays(today, -1), publishedAt: new Date() })
      .returning();
    expect(await closeExpired(db)).toBeGreaterThanOrEqual(1);
    const [after] = await db.select().from(notices).where(eq(notices.id, n.id));
    expect(after.status).toBe("closed");
    expect(await closeExpired(db)).toBe(0);
  });

  it("enforces one discovery per normalised URL", async () => {
    const fp = sha256(normalizeUrl("https://www.ssc.gov.in/a.pdf#x"));
    await db.insert(discoveries).values({ sourceId: src.id, url: "https://www.ssc.gov.in/a.pdf#x", linkText: "x", fingerprint: fp });
    const again = await db
      .insert(discoveries)
      .values({ sourceId: src.id, url: "https://ssc.gov.in/a.pdf", linkText: "x", fingerprint: sha256(normalizeUrl("https://ssc.gov.in/a.pdf")) })
      .onConflictDoNothing()
      .returning();
    expect(again).toHaveLength(0);
  });
});
