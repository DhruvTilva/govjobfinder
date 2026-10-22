import { and, asc, eq, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import * as cheerio from "cheerio";
import type { DB } from "@/db/client";
import {
  discoveries,
  organizations,
  pipelineEvents,
  pipelineRequests,
  pipelineRuns,
  qualifications,
  sectors,
  sources,
  type SourceConfig,
} from "@/db/schema";
import { decodeText, FetchError } from "./net";
import { PoliteFetcher } from "./polite";
import { harvestLinks, type HarvestedLink } from "./harvest";
import { processDiscovery, closeExpired, type ProcessOutcome, type SourceCtx, type Taxonomy } from "./process";
import { mapLimit } from "./validate";
import { isOfficialUrl, normalizeUrl } from "@/lib/url";
import { clean, sha256 } from "@/lib/text";

export type RunOptions = {
  trigger: "schedule" | "manual" | "admin" | "source";
  /** Restrict to these sources (scanned even if not due). */
  sourceIds?: number[];
  maxSources?: number;
  processLimit?: number;
  timeBudgetMs?: number;
  /** Skip the "another run is active" check (single-source admin scans). */
  allowConcurrent?: boolean;
  /** Injectable for tests. */
  fetcher?: PoliteFetcher;
};

export type RunResult = { runId: number | null; status: string; stats: Record<string, number>; skipped?: string };

const STALE_RUN_MS = 30 * 60_000;
const MAX_BACKOFF_MS = 3 * 86_400_000;

type SourceRow = typeof sources.$inferSelect;
type Ctx = {
  db: DB;
  runId: number;
  fetcher: PoliteFetcher;
  taxonomy: Taxonomy;
  stats: Record<string, number>;
  deadline: number;
  /** Sources whose listing loaded but some of whose documents failed in this run. */
  partialSources: Set<number>;
};

function bump(stats: Record<string, number>, key: string, n = 1) {
  stats[key] = (stats[key] ?? 0) + n;
}

async function logEvent(ctx: Pick<Ctx, "db" | "runId">, level: "info" | "warn" | "error", message: string, ids: { sourceId?: number; discoveryId?: number } = {}, data?: unknown) {
  await ctx.db.insert(pipelineEvents).values({ runId: ctx.runId, level, message: message.slice(0, 1000), sourceId: ids.sourceId, discoveryId: ids.discoveryId, data: data ?? null });
}

export function parseFeed(xml: string, baseUrl: string): HarvestedLink[] {
  const $ = cheerio.load(xml, { xml: true });
  const out: HarvestedLink[] = [];
  $("item, entry").each((_, el) => {
    const item = $(el);
    const link = item.find("link").first();
    const href = link.attr("href") || link.text();
    const title = clean(item.find("title").first().text()) ?? "";
    try {
      if (href && title) out.push({ url: new URL(href.trim(), baseUrl).toString(), text: title, context: "" });
    } catch {
      /* skip */
    }
  });
  $("url > loc").each((_, el) => {
    const loc = $(el).text().trim();
    try {
      const u = new URL(loc, baseUrl);
      const text = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ").replace(/\.\w+$/, "");
      if (text.length >= 8) out.push({ url: u.toString(), text, context: "" });
    } catch {
      /* skip */
    }
  });
  return out;
}

/** "blocked" = the site (or our safety rules) refuses us on purpose; "broken" = it is not working. */
export function urlStatusFor(fe: FetchError): "timeout" | "blocked" | "broken" {
  if (fe.code === "timeout") return "timeout";
  if (fe.code === "blocked" || fe.code === "robots") return "blocked";
  if (fe.code === "http" && (fe.status === 401 || fe.status === 403 || fe.status === 429)) return "blocked";
  return "broken";
}

/** Error text for the Sources page: the raw error plus what it means for an operator. */
export function describeFailure(fe: FetchError): string {
  const m = fe.message;
  let why = "";
  if (fe.code === "robots") why = "the site's robots.txt does not allow crawling this page";
  else if (fe.code === "http" && (fe.status === 401 || fe.status === 403)) why = "the site refuses automated access";
  else if (fe.code === "http" && fe.status === 429) why = "rate-limited by the site";
  else if (fe.code === "http" && fe.status === 404) why = "page not found; the listing URL has probably moved";
  else if (fe.code === "http" && (fe.status ?? 0) >= 500) why = "server error on the site; usually temporary";
  else if (fe.code === "timeout") why = "no response in time; the site may be down or not reachable from this network";
  else if (/CERT_HAS_EXPIRED/.test(m)) why = "the site's TLS certificate has expired";
  else if (/ALTNAME|HOSTNAME/.test(m)) why = "the TLS certificate does not cover this hostname";
  else if (/ENOTFOUND/.test(m)) why = "the domain does not exist (DNS)";
  else if (/EAI_AGAIN/.test(m)) why = "DNS lookup failed; the domain's name servers are not answering";
  else if (/ECONNREFUSED/.test(m)) why = "the server refused the connection";
  else if (/ECONNRESET/.test(m)) why = "the server reset the connection";
  return `${fe.code}: ${m}${why ? ` (${why})` : ""}`;
}

async function scanSource(ctx: Ctx, src: SourceRow): Promise<void> {
  const { db } = ctx;
  const now = new Date();
  const config = (src.config ?? {}) as SourceConfig;
  await db.update(sources).set({ lastCheckStatus: "checking" }).where(eq(sources.id, src.id));
  try {
    const res = await ctx.fetcher.fetch(src.url, { etag: src.etag, lastModified: src.lastModified, maxBytes: 6 * 1024 * 1024 });
    let found = 0;
    let fresh = 0;
    let linkHash = src.contentHash;
    if (!res.notModified) {
      const body = decodeText(res.body, res.contentType);
      const isFeed = src.method === "rss" || src.method === "sitemap" || /xml|rss|atom/.test(res.contentType);
      const domains = src.allowedDomains;
      const links = (isFeed ? parseFeed(body, res.finalUrl) : harvestLinks(body, res.finalUrl, config)).filter((l) => isOfficialUrl(l.url, domains));
      found = links.length;
      linkHash = sha256(links.map((l) => l.url).sort().join("\n"));
      if (linkHash !== src.contentHash && links.length) {
        const fingerprints: string[] = [];
        for (const l of links) {
          let fingerprint: string;
          try {
            fingerprint = sha256(normalizeUrl(l.url));
          } catch {
            continue;
          }
          fingerprints.push(fingerprint);
          const inserted = await db
            .insert(discoveries)
            .values({ sourceId: src.id, url: l.url, linkText: l.text.slice(0, 500), fingerprint })
            .onConflictDoNothing()
            .returning({ id: discoveries.id });
          if (inserted.length) fresh++;
        }
        await db
          .update(discoveries)
          .set({ lastSeenAt: now })
          .where(and(eq(discoveries.sourceId, src.id), inArray(discoveries.fingerprint, fingerprints)));
      }
    }
    bump(ctx.stats, "sourcesScanned");
    bump(ctx.stats, "linksFound", found);
    bump(ctx.stats, "newDiscoveries", fresh);
    await db
      .update(sources)
      .set({
        lastCheckedAt: now,
        lastSuccessAt: now,
        lastStatusCode: res.status,
        lastError: null,
        consecutiveFailures: 0,
        lastCheckStatus: (res.notModified ? src.lastCheckFound : found) === 0 ? "no_links" : fresh ? "new_notices" : "no_new",
        lastCheckFound: res.notModified ? src.lastCheckFound : found,
        lastCheckNew: fresh,
        etag: res.headers["etag"] ?? null,
        lastModified: res.headers["last-modified"] ?? null,
        contentHash: linkHash,
        finalUrl: res.finalUrl,
        urlStatus: "ok",
        urlCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + src.intervalMinutes * 60_000),
        ...(fresh ? { lastDiscoveryAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(sources.id, src.id));
    if (fresh) await logEvent(ctx, "info", `${fresh} new link(s) discovered`, { sourceId: src.id });
    if (!res.notModified && found === 0) await logEvent(ctx, "warn", "No recruitment links found on page; selector or URL may need updating", { sourceId: src.id });
  } catch (e) {
    const fe = e instanceof FetchError ? e : new FetchError(e instanceof Error ? e.message : String(e), "network");
    const failures = src.consecutiveFailures + 1;
    const backoff = Math.min(src.intervalMinutes * 60_000 * 2 ** Math.min(failures, 4), MAX_BACKOFF_MS);
    bump(ctx.stats, "sourceErrors");
    await db
      .update(sources)
      .set({
        lastCheckedAt: now,
        lastError: describeFailure(fe).slice(0, 500),
        lastStatusCode: fe.status ?? null,
        consecutiveFailures: failures,
        lastCheckStatus: "failed",
        urlStatus: urlStatusFor(fe),
        nextCheckAt: new Date(now.getTime() + backoff),
        updatedAt: now,
      })
      .where(eq(sources.id, src.id));
    await logEvent(ctx, "error", `Scan failed: ${fe.message}`, { sourceId: src.id }, { code: fe.code, status: fe.status, failures });
  }
}

async function loadTaxonomy(db: DB): Promise<Taxonomy> {
  const [s, q] = await Promise.all([
    db.select({ id: sectors.id, keywords: sectors.keywords }).from(sectors),
    db.select({ id: qualifications.id, patterns: qualifications.patterns }).from(qualifications),
  ]);
  return { sectors: s, qualifications: q };
}

async function sourceContexts(db: DB, ids: number[]): Promise<Map<number, SourceCtx>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ s: sources, o: organizations })
    .from(sources)
    .leftJoin(organizations, eq(sources.organizationId, organizations.id))
    .where(inArray(sources.id, ids));
  return new Map(
    rows.map(({ s, o }) => [
      s.id,
      {
        id: s.id,
        url: s.url,
        trust: s.trust,
        allowedDomains: s.allowedDomains,
        config: s.config ?? {},
        organization: o ? { id: o.id, level: o.level, stateId: o.stateId, sectorId: o.sectorId, officialDomains: o.officialDomains } : null,
      },
    ]),
  );
}

export async function runPipeline(db: DB, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const timeBudgetMs = opts.timeBudgetMs ?? 20 * 60_000;

  // Fail runs that stopped heartbeating (crashed worker), so they don't block new runs.
  await db
    .update(pipelineRuns)
    .set({ status: "failed", error: "Run stopped responding (no heartbeat)", finishedAt: new Date() })
    .where(and(eq(pipelineRuns.status, "running"), lt(pipelineRuns.heartbeatAt, new Date(started - STALE_RUN_MS))));

  if (!opts.allowConcurrent) {
    const [active] = await db.select({ id: pipelineRuns.id }).from(pipelineRuns).where(and(eq(pipelineRuns.status, "running"), ne(pipelineRuns.trigger, "source"))).limit(1);
    if (active) return { runId: null, status: "skipped", stats: {}, skipped: `Run #${active.id} is still in progress` };
  }
  // A source left "checking" with no run in progress was interrupted (crash, timeout, cancelled job).
  const [anyRunning] = await db.select({ id: pipelineRuns.id }).from(pipelineRuns).where(eq(pipelineRuns.status, "running")).limit(1);
  if (!anyRunning) {
    await db
      .update(sources)
      .set({ lastCheckStatus: "failed", lastError: "Check was interrupted before it finished", updatedAt: new Date() })
      .where(eq(sources.lastCheckStatus, "checking"));
  }

  const [run] = await db
    .insert(pipelineRuns)
    .values({ trigger: opts.trigger, sourceId: opts.sourceIds?.length === 1 ? opts.sourceIds[0] : null })
    .returning({ id: pipelineRuns.id });
  const ctx: Ctx = { db, runId: run.id, fetcher: opts.fetcher ?? new PoliteFetcher(), taxonomy: await loadTaxonomy(db), stats: {}, deadline: started + timeBudgetMs, partialSources: new Set() };
  const heartbeat = setInterval(() => {
    void db.update(pipelineRuns).set({ heartbeatAt: new Date(), stats: ctx.stats }).where(eq(pipelineRuns.id, run.id)).catch(() => undefined);
  }, 30_000);

  try {
    // 1. Which sources to scan.
    let toScan: SourceRow[];
    if (opts.sourceIds?.length) {
      toScan = await db.select().from(sources).where(inArray(sources.id, opts.sourceIds));
    } else {
      const requests = await db.update(pipelineRequests).set({ pickedAt: new Date() }).where(isNull(pipelineRequests.pickedAt)).returning({ sourceId: pipelineRequests.sourceId });
      const requested = requests.map((r) => r.sourceId).filter((x): x is number => x != null);
      const forceAll = requests.some((r) => r.sourceId == null);
      const due = await db
        .select()
        .from(sources)
        .where(
          and(
            eq(sources.enabled, true),
            ne(sources.method, "manual"),
            forceAll ? sql`true` : or(isNull(sources.nextCheckAt), lte(sources.nextCheckAt, new Date()), requested.length ? inArray(sources.id, requested) : sql`false`),
          ),
        )
        .orderBy(asc(sources.priority), sql`${sources.nextCheckAt} asc nulls first`)
        .limit(opts.maxSources ?? 80);
      toScan = due;
    }
    await logEvent(ctx, "info", `Scanning ${toScan.length} source(s)`);

    // 2. Scan listing pages. Different hosts run in parallel; PoliteFetcher serialises per host.
    await mapLimit(toScan, 6, async (s) => {
      if (Date.now() > ctx.deadline) return bump(ctx.stats, "sourcesDeferred");
      await scanSource(ctx, s);
    });

    // 3. Process new and retryable discoveries (highest-priority sources first).
    const pending = await db
      .select({ d: discoveries })
      .from(discoveries)
      .innerJoin(sources, eq(discoveries.sourceId, sources.id))
      .where(
        and(
          or(eq(discoveries.state, "new"), and(eq(discoveries.state, "failed"), lte(discoveries.nextAttemptAt, new Date()))),
          opts.sourceIds?.length ? inArray(discoveries.sourceId, opts.sourceIds) : sql`true`,
        ),
      )
      .orderBy(asc(sources.priority), asc(discoveries.firstSeenAt))
      .limit(opts.processLimit ?? 400);
    const srcMap = await sourceContexts(db, [...new Set(pending.map((p) => p.d.sourceId))]);

    await mapLimit(pending, 4, async ({ d }) => {
      if (Date.now() > ctx.deadline) return bump(ctx.stats, "processingDeferred");
      const src = srcMap.get(d.sourceId);
      if (!src) return;
      let outcome: ProcessOutcome;
      try {
        outcome = await processDiscovery(
          { db, fetcher: ctx.fetcher, taxonomy: ctx.taxonomy, log: (level, message, data) => logEvent(ctx, level, message, { sourceId: d.sourceId, discoveryId: d.id }, data) },
          d,
          src,
        );
      } catch (e) {
        outcome = "failed";
        const msg = e instanceof Error ? e.message : String(e);
        await db.update(discoveries).set({ state: "failed", attempts: d.attempts + 1, lastError: msg.slice(0, 500), nextAttemptAt: new Date(Date.now() + 6 * 3600_000) }).where(eq(discoveries.id, d.id));
        await logEvent(ctx, "error", `Processing failed: ${msg}`, { sourceId: d.sourceId, discoveryId: d.id });
      }
      bump(ctx.stats, outcome);
      if (outcome === "failed" || outcome === "retry") ctx.partialSources.add(d.sourceId);
    });
    if (ctx.partialSources.size) {
      await db
        .update(sources)
        .set({ lastCheckStatus: "partial" })
        .where(and(inArray(sources.id, [...ctx.partialSources]), inArray(sources.lastCheckStatus, ["new_notices", "no_new"])));
    }

    // 4. Lifecycle: close notices whose last date has passed.
    bump(ctx.stats, "closed", await closeExpired(db));

    const status = (ctx.stats.sourceErrors ?? 0) > 0 || (ctx.stats.failed ?? 0) > 0 ? "partial" : "success";
    await db.update(pipelineRuns).set({ status, stats: ctx.stats, finishedAt: new Date(), heartbeatAt: new Date() }).where(eq(pipelineRuns.id, run.id));
    return { runId: run.id, status, stats: ctx.stats };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(pipelineRuns).set({ status: "failed", error: msg.slice(0, 1000), stats: ctx.stats, finishedAt: new Date() }).where(eq(pipelineRuns.id, run.id));
    await logEvent(ctx, "error", `Run failed: ${msg}`);
    return { runId: run.id, status: "failed", stats: ctx.stats };
  } finally {
    clearInterval(heartbeat);
  }
}
