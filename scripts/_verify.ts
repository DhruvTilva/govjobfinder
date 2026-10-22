import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { PoliteFetcher } from "@/pipeline/polite";
import { decodeText } from "@/pipeline/net";
import { harvestLinks } from "@/pipeline/harvest";
import { hostnameOf, isOfficialUrl } from "@/lib/url";
import { mapLimit } from "@/pipeline/validate";

const [inFile, outFile] = process.argv.slice(2);
const rows = readFileSync(inFile, "utf8").trim().split("\n").map((l) => { const [st, sector, level, name, short, url] = l.split("\t"); return { st, sector, level, name, short, url }; });
const f = new PoliteFetcher();
const SECTION = /recruit|career|vacanc|job|advertis|employment|notification|notice|what'?s\s*new|भर्ती/i;

async function linksOn(url: string, domains: string[]) {
  const r = await f.fetch(url, { maxBytes: 6 * 1024 * 1024 });
  const html = decodeText(r.body, r.contentType);
  return { html, finalUrl: r.finalUrl, links: harvestLinks(html, r.finalUrl).filter((l) => isOfficialUrl(l.url, domains)) };
}
const out: Record<string, unknown>[] = [];
await mapLimit(rows, 8, async (c) => {
  const host = hostnameOf(c.url)!;
  const domains = [host];
  const rec: Record<string, unknown> = { ...c };
  try {
    const home = await linksOn(c.url, domains);
    rec.finalUrl = home.finalUrl;
    domains.push(hostnameOf(home.finalUrl)!);
    let best = { url: home.finalUrl, n: home.links.length, sample: home.links.slice(0, 3).map((l) => l.text.slice(0, 70)) };
    if (best.n < 3) {
      const $ = cheerio.load(home.html);
      const cands = new Set<string>();
      $("a[href]").each((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim(); const h = $(el).attr("href")!;
        if (!t || t.length > 50 || !SECTION.test(t + " " + h)) return;
        try { const u = new URL(h, home.finalUrl); u.hash = ""; if (!/\.(pdf|jpe?g|png|docx?)$/i.test(u.pathname) && isOfficialUrl(u.toString(), domains) && u.toString() !== home.finalUrl) cands.add(u.toString()); } catch {}
      });
      for (const u of [...cands].slice(0, 6)) {
        try { const p = await linksOn(u, domains); if (p.links.length > best.n) best = { url: p.finalUrl, n: p.links.length, sample: p.links.slice(0, 3).map((l) => l.text.slice(0, 70)) }; } catch {}
      }
    }
    Object.assign(rec, { ok: true, listing: best.url, links: best.n, sample: best.sample });
  } catch (e) { Object.assign(rec, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
  out.push(rec);
});
writeFileSync(outFile, JSON.stringify(out, null, 1));
for (const r of out) console.log(`${r.ok ? (r.links as number) > 0 ? "LINKS " + r.links : "NOLINKS" : "ERR"}\t${r.st}\t${r.short}\t${r.ok ? r.listing : r.error}\t${((r.sample as string[]) ?? []).join(" | ").slice(0, 120)}`);
process.exit(0);
