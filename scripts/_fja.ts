import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
const dir = process.argv[2];
const out: { page: string; board: string; post: string; link: string }[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
  const $ = cheerio.load(readFileSync(`${dir}/${f}`, "utf8"));
  $("table").each((_, t) => {
    const head = $(t).find("tr").first().find("th,td").map((_, c) => $(c).text().trim().toLowerCase()).get();
    const bi = head.findIndex((h) => /board|organi[sz]ation|recruit/i.test(h));
    const pi = head.findIndex((h) => /post/i.test(h));
    if (bi < 0) return;
    $(t).find("tr").slice(1).each((_, r) => {
      const cells = $(r).find("td");
      const board = $(cells[bi]).text().replace(/\s+/g, " ").trim();
      if (board) out.push({ page: f.replace(".html", ""), board, post: $(cells[pi]).text().replace(/\s+/g, " ").trim().slice(0, 80), link: $(r).find("a[href]").last().attr("href") ?? "" });
    });
  });
}
writeFileSync(`${dir}/boards.json`, JSON.stringify(out));
const counts = new Map<string, number>();
for (const o of out) counts.set(o.board, (counts.get(o.board) ?? 0) + 1);
console.log("rows:", out.length, "distinct boards:", counts.size);
console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}:${n}`).join(" | "));
