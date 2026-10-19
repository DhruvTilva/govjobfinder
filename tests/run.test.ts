import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.ANTHROPIC_API_KEY = "";

const { getDb, closeDb } = await import("@/db/client");
const { runMigrations } = await import("@/db/migrate");
const { seedReferenceData } = await import("@/db/seed");
const schema = await import("@/db/schema");
const { runPipeline } = await import("@/pipeline/run");
const { FetchError } = await import("@/pipeline/net");
const { addDays, todayIST } = await import("@/pipeline/dates");
type PoliteFetcher = import("@/pipeline/polite").PoliteFetcher;
type FetchResult = import("@/pipeline/net").FetchResult;

const { sources, organizations, notices, pipelineRuns, discoveries } = schema;
type DB = Awaited<ReturnType<typeof getDb>>;

/**
 * Whole-run tests (scan → discover → process → source status) with a fake network.
 * Each URL maps to an HTML body or to an error to throw.
 */
const pages = new Map<string, string | Error>();
const fakeFetcher = {
  async fetch(url: string): Promise<FetchResult> {
    const page = pages.get(url);
    if (page instanceof Error) throw page;
    if (page == null) throw new FetchError(`HTTP 404 for ${url}`, "http", 404);
    return { url, finalUrl: url, status: 200, contentType: "text/html; charset=utf-8", headers: {}, body: new TextEncoder().encode(page), notModified: false };
  },
} as unknown as PoliteFetcher;

let db: DB;
let sourceId: number;
let listingUrl: string;
const today = todayIST();
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const end = addDays(today, 25);

const listing = (items: [string, string][]) =>
  `<html><body><ul>${items.map(([href, text]) => `<li><a href="${href}">${text}</a></li>`).join("")}</ul></body></html>`;
const noticePage = (advt: string, posts: number) =>
  `<html><body><h1>Staff Selection Commission</h1><p>Notice No. ${advt}</p><p>Recruitment of Multi Tasking Staff 2026</p>` +
  `<p>Total Posts: ${posts}</p><p>Last date for receipt of online applications: ${fmt(end)}</p>` +
  `<p>Age Limit: 18 to 25 years</p><p>Essential Qualification: Matriculation (10th pass) from a recognised Board.</p></body></html>`;

async function source() {
  const [s] = await db.select().from(sources).where(eq(sources.id, sourceId));
  return s;
}
const run = () => runPipeline(db, { trigger: "manual", sourceIds: [sourceId], fetcher: fakeFetcher, timeBudgetMs: 60_000 });

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  await seedReferenceData(db);
  const [row] = await db
    .select({ s: sources })
    .from(sources)
    .innerJoin(organizations, eq(sources.organizationId, organizations.id))
    .where(eq(organizations.slug, "ssc"));
  sourceId = row.s.id;
  listingUrl = row.s.url;
  await db.update(sources).set({ trust: "trusted" }).where(eq(sources.id, sourceId));
});

afterAll(async () => {
  await closeDb();
});

describe("getDb", () => {
  it("returns one shared instance to concurrent callers (no leaked pools)", async () => {
    await closeDb();
    const all = await Promise.all(Array.from({ length: 10 }, () => getDb()));
    expect(new Set(all).size).toBe(1);
    db = all[0];
    await runMigrations();
    await seedReferenceData(db);
    await db.update(sources).set({ trust: "trusted" }).where(eq(sources.id, sourceId));
  });
});

describe("runPipeline source status", () => {
  it("starts as never checked", async () => {
    expect((await source()).lastCheckStatus).toBe("never");
  });

  it("records a successful check with new notices and publishes the notice", async () => {
    const origin = new URL(listingUrl).origin;
    pages.set(listingUrl, listing([["/notice/mts-2026", "Recruitment notice: Multi Tasking Staff Examination 2026"]]));
    pages.set(`${origin}/notice/mts-2026`, noticePage("HQ-MTS/2/2026", 8000));
    const r = await run();
    expect(r.status).toBe("success");
    const s = await source();
    expect(s).toMatchObject({ lastCheckStatus: "new_notices", lastCheckFound: 1, lastCheckNew: 1, consecutiveFailures: 0 });
    expect(s.lastSuccessAt).not.toBeNull();
    const [n] = await db.select().from(notices).where(eq(notices.sourceId, sourceId));
    expect(n).toMatchObject({ status: "published", kind: "recruitment", applyEnd: end, totalPosts: 8000 });
  });

  it("is idempotent: rescanning the same listing finds nothing new and creates no duplicates", async () => {
    const r = await run();
    expect(r.status).toBe("success");
    expect((await source()).lastCheckStatus).toBe("no_new");
    expect(await db.select().from(notices).where(eq(notices.sourceId, sourceId))).toHaveLength(1);
  });

  it("marks the source partial when the listing loads but a document times out", async () => {
    const origin = new URL(listingUrl).origin;
    pages.set(
      listingUrl,
      listing([
        ["/notice/mts-2026", "Recruitment notice: Multi Tasking Staff Examination 2026"],
        ["/notice/steno-2026", "Recruitment notice: Stenographer Grade C and D Examination 2026"],
      ]),
    );
    pages.set(`${origin}/notice/steno-2026`, new FetchError("timed out", "timeout"));
    const r = await run();
    expect(r.status).toBe("success");
    expect(r.stats.retry).toBe(1);
    expect(await source()).toMatchObject({ lastCheckStatus: "partial", lastCheckFound: 2, lastCheckNew: 1 });
    const [d] = await db.select().from(discoveries).where(eq(discoveries.url, `${origin}/notice/steno-2026`));
    expect(d).toMatchObject({ state: "failed", attempts: 1 });
    expect(d.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("distinguishes a failed check and backs off", async () => {
    pages.set(listingUrl, new FetchError("Service unavailable", "http", 503));
    const before = Date.now();
    const r = await run();
    expect(r.status).toBe("partial");
    const s = await source();
    expect(s).toMatchObject({ lastCheckStatus: "failed", consecutiveFailures: 1, lastStatusCode: 503, urlStatus: "broken" });
    expect(s.lastError).toContain("Service unavailable");
    expect(s.nextCheckAt!.getTime()).toBeGreaterThan(before + s.intervalMinutes * 60_000);
    // The earlier successful check time is kept.
    expect(s.lastSuccessAt).not.toBeNull();
  });

  it("marks a check left 'checking' by a crashed run as failed on the next run", async () => {
    const [other] = await db.select({ id: sources.id }).from(sources).where(eq(sources.enabled, true)).limit(1);
    const otherId = other.id === sourceId ? sourceId + 1 : other.id;
    await db.update(sources).set({ lastCheckStatus: "checking" }).where(eq(sources.id, otherId));
    await db.insert(pipelineRuns).values({ trigger: "schedule", status: "running", heartbeatAt: new Date(Date.now() - 60 * 60_000), startedAt: new Date(Date.now() - 60 * 60_000) });
    pages.set(listingUrl, listing([]));
    await run();
    const [s] = await db.select().from(sources).where(eq(sources.id, otherId));
    expect(s.lastCheckStatus).toBe("failed");
    expect(s.lastError).toMatch(/interrupted/);
    const stale = await db.select().from(pipelineRuns).where(eq(pipelineRuns.error, "Run stopped responding (no heartbeat)"));
    expect(stale).toHaveLength(1);
  });

  it("refuses to start while another run is active", async () => {
    const [active] = await db.insert(pipelineRuns).values({ trigger: "schedule", status: "running" }).returning();
    const r = await run();
    expect(r.status).toBe("skipped");
    expect(r.skipped).toContain(`#${active.id}`);
    await db.update(pipelineRuns).set({ status: "success", finishedAt: new Date() }).where(eq(pipelineRuns.id, active.id));
  });
});
