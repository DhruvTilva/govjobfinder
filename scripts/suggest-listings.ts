import "./env";
import * as cheerio from "cheerio";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
import { sources } from "@/db/schema";
import { PoliteFetcher } from "@/pipeline/polite";
import { decodeText } from "@/pipeline/net";
import { harvestLinks } from "@/pipeline/harvest";
import { isOfficialUrl } from "@/lib/url";
import { mapLimit } from "@/pipeline/validate";

/**
 * For sources whose listing page loads but yields no notice links (usually a home page),
 * follows the site's own "Recruitment / Careers / Vacancies / Notifications" links and
 * reports how many notice links each candidate page would yield. Read-only.
 *   npx tsx scripts/suggest-listings.ts            # all ok sources with no discoveries
 *   npx tsx scripts/suggest-listings.ts 108,123    # specific source ids
 */
const SECTION = /recruit|career|vacanc|advertis|employment|job|notification|what'?s\s*new|latest\s*news|notice|भर्ती|रिक्ति/i;

const db = await getDb();
const ids = process.argv[2]?.split(",").map(Number).filter(Boolean);
const rows = await db
  .select()
  .from(sources)
  .where(
    ids?.length
      ? inArray(sources.id, ids)
      : and(eq(sources.urlStatus, "ok"), eq(sources.enabled, true), sql`not exists (select 1 from discoveries d where d.source_id = ${sources.id})`),
  );
const fetcher = new PoliteFetcher();

async function linksOn(url: string, domains: string[]) {
  const r = await fetcher.fetch(url, { maxBytes: 6 * 1024 * 1024, timeoutMs: 25_000 });
  const html = decodeText(r.body, r.contentType);
  return { html, finalUrl: r.finalUrl, links: harvestLinks(html, r.finalUrl).filter((l) => isOfficialUrl(l.url, domains)) };
}

const results: { id: number; name: string; best?: { url: string; n: number; sample: string[] }; note?: string }[] = [];
await mapLimit(rows, 6, async (s) => {
  try {
    const home = await linksOn(s.finalUrl ?? s.url, s.allowedDomains);
    const $ = cheerio.load(home.html);
    const cands = new Map<string, string>();
    $("a[href]").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const href = $(el).attr("href")!;
      if (!text || text.length > 60 || !SECTION.test(text + " " + href)) return;
      try {
        const u = new URL(href, home.finalUrl);
        u.hash = "";
        if (/\.(pdf|docx?|xlsx?|jpe?g|png)$/i.test(u.pathname)) return;
        if (isOfficialUrl(u.toString(), s.allowedDomains) && u.toString() !== home.finalUrl) cands.set(u.toString(), text);
      } catch {
        /* skip */
      }
    });
    let best: { url: string; n: number; sample: string[] } | undefined;
    for (const url of [...cands.keys()].slice(0, 8)) {
      try {
        const page = await linksOn(url, s.allowedDomains);
        if (!best || page.links.length > best.n) best = { url: page.finalUrl, n: page.links.length, sample: page.links.slice(0, 3).map((l) => l.text.slice(0, 90)) };
      } catch {
        /* candidate failed */
      }
    }
    const jsApp = /<app-root|ng-version|id="root"><\/div>|id="__next"/i.test(home.html) && home.html.length < 20_000;
    results.push({ id: s.id, name: s.name, best: best && best.n > 0 ? best : undefined, note: jsApp ? "JavaScript-rendered page" : cands.size ? undefined : "no section links found" });
  } catch (e) {
    results.push({ id: s.id, name: s.name, note: `error: ${e instanceof Error ? e.message : e}` });
  }
});
await closeDb();
for (const r of results.sort((a, b) => a.id - b.id)) {
  if (r.best) console.log(`${r.id}\t${r.name}\t${r.best.n}\t${r.best.url}\t${r.best.sample.join(" | ")}`);
  else console.log(`${r.id}\t${r.name}\t0\t-\t${r.note ?? "no candidate yielded links"}`);
}
process.exit(0);
