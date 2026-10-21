import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
const [file, base] = process.argv.slice(2);
const $ = cheerio.load(readFileSync(file, "utf8"));
const seen = new Map<string, string>();
$("a[href]").each((_, el) => {
  const t = $(el).text().replace(/\s+/g, " ").trim(); const h = $(el).attr("href")!;
  try { const u = new URL(h, base); if (u.hostname === new URL(base).hostname && t && !seen.has(u.pathname)) seen.set(u.pathname, t); } catch {}
});
const paths = [...seen.entries()];
console.log("internal links:", paths.length);
for (const [p, t] of paths.filter(([p]) => p.split("/").filter(Boolean).length <= 1).slice(0, 120)) console.log(p, "|", t.slice(0, 60));
