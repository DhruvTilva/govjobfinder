import { listNotices, parseFilters } from "@/lib/queries";
import { formatDate, KIND_LABEL, noticeHref } from "@/lib/status";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/**
 * RSS feed of newly published notices. Accepts the same filters as /jobs
 * (state, sector, qual, org, kind), so candidates can subscribe to e.g.
 * /feed.xml?state=bihar&qual=12th-pass in any feed reader.
 */
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = parseFilters(sp);
  const { items } = await listNotices({ ...f, status: f.status ?? "all", sort: "latest", page: 1 }, f.kind ?? "any", 50);
  const self = siteUrl("/feed.xml" + (new URL(req.url).search || ""));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(SITE_NAME)} — latest government job notices</title>
<link>${esc(siteUrl("/jobs"))}</link>
<atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>
<description>New recruitment notices, admit cards, results and answer keys from official government websites.</description>
<language>en-IN</language>
${items
  .map((n) => {
    const desc = [KIND_LABEL[n.kind], n.orgName, n.stateName ?? (n.isCentral ? "All India" : null), n.applyEnd ? `Last date ${formatDate(n.applyEnd)}` : null]
      .filter(Boolean)
      .join(" · ");
    return `<item><title>${esc(n.title)}</title><link>${esc(siteUrl(noticeHref(n)))}</link><guid isPermaLink="true">${esc(siteUrl(noticeHref(n)))}</guid><pubDate>${(n.publishedAt ?? n.firstSeenAt).toUTCString()}</pubDate><description>${esc(desc)}</description></item>`;
  })
  .join("\n")}
</channel>
</rss>`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
