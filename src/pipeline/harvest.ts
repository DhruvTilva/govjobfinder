import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { SourceConfig } from "@/db/schema";
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, compilePatterns } from "./classify";
import { clean } from "@/lib/text";

export type HarvestedLink = { url: string; text: string; context: string };

const DOC_EXT = /\.(pdf|docx?|xlsx?)$/i;

/**
 * Link labels that say what to do, not what the notice is ("Download Advertisement",
 * "Click here to view the detailed advertisement - [pdf, 175 KB]", "View (English)").
 * A label is generic when nothing is left after removing such words and file details;
 * for these the row's own text is the better title.
 */
const GENERIC_WORDS =
  /\b(?:click|here|to|the|view|download|read|more|see|open|detailed|details?|advertisement|advt|notification|notice|link|pdf|file|document|attachment|english|hindi|new|apply|online|kb|mb|size)\b|\d+(?:\.\d+)?|[^\p{L}]+/giu;

export function isGenericLinkText(text: string): boolean {
  return text.replace(GENERIC_WORDS, "").length < 3;
}

/**
 * Title for a generic link: the text of the nearest ancestor that adds real text but still
 * belongs to this one notice (≤ 2 links, ≤ 350 chars): a table row (NPCIL), or a card
 * several divs up (BEL). The generic label itself is dropped, and climbing continues while
 * what is left is still generic. (Allowing more links merged neighbouring notices.)
 */
function noticeContext($: cheerio.CheerioAPI, a: cheerio.Cheerio<AnyNode>, ownText: string): string | null {
  let el = a.parent();
  for (let depth = 0; depth < 7 && el.length && !el.is("body"); depth++, el = el.parent()) {
    if (el.find("a[href]").length > 2) return null;
    const text = clean(el.text()) ?? "";
    if (text.length > 350) return null;
    const rest = clean(text.replace(ownText, " ")) ?? "";
    if (rest.length >= 15 && !isGenericLinkText(rest)) return rest;
  }
  return null;
}
const SKIP_EXT = /\.(jpe?g|png|gif|svg|webp|mp4|mp3|zip|rar|exe|apk|css|js)$/i;

/**
 * Extracts candidate notice links from a listing page. A link qualifies when its
 * text (or text plus nearby context for generic "Click here"/"Download" links)
 * matches the include vocabulary and does not match the exclude list.
 */
export function harvestLinks(html: string, baseUrl: string, config: SourceConfig = {}): HarvestedLink[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, header nav, footer").remove();
  const include = compilePatterns(config.include?.length ? config.include : DEFAULT_INCLUDE);
  const exclude = compilePatterns([...DEFAULT_EXCLUDE, ...(config.exclude ?? [])]);
  const scope = config.selector ? $(config.selector) : $("body");
  const anchors = scope.is("a") ? scope : scope.find("a[href]");

  const seen = new Set<string>();
  const out: HarvestedLink[] = [];
  anchors.each((_, el) => {
    const a = $(el);
    const href = a.attr("href")?.trim();
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel|data):/i.test(href)) return;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (SKIP_EXT.test(url.pathname)) return;
    url.hash = "";

    const ownText = clean(a.text() || a.attr("title") || a.attr("aria-label") || "") ?? "";
    // Generic anchors ("Click here", "Download Advertisement") borrow the text of their row/list item.
    const container = a.closest("tr, li, p, td");
    // A large container is a menu or page section, not the notice's own row.
    // A row with several links ("Notification | Result | Answer key") would glue their labels together.
    const rawContext = clean(container.length ? container.text() : "") ?? "";
    const context = rawContext.length <= 350 && container.find("a[href]").length <= 2 ? rawContext : "";
    const generic = ownText.length < 12 || isGenericLinkText(ownText);
    const text = (generic ? noticeContext($, a, ownText) ?? (context.length > ownText.length ? context : ownText) : ownText).slice(0, 400);
    if (text.length < 8) return;
    // Un-rendered client-side template text ("{{ 'KEY' | translate }}") is not a title.
    if (/\{\{|\}\}|\$\{/.test(text)) return;

    const haystack = `${text} ${decodeURIComponentSafe(url.pathname)}`;
    if (!include.some((re) => re.test(haystack))) return;
    if (exclude.some((re) => re.test(text))) return;
    // Navigation to section pages ("Recruitment", "Advertisement") is not a notice. Keep a link
    // only when it points at a document or its text is long enough to describe a specific notice.
    const looksSpecific = DOC_EXT.test(url.pathname) ? text.length >= 15 : text.length >= 30;
    if (!looksSpecific) return;

    const key = url.toString();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: key, text, context: context.slice(0, 600) });
  });
  return out.slice(0, config.maxItems ?? 40);
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s).replace(/[_-]+/g, " ");
  } catch {
    return s;
  }
}

/** Extracts readable text from an HTML document for field extraction. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, iframe").remove();
  $("br").replaceWith("\n");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, table").each((_, el) => {
    $(el).append("\n");
  });
  $("td, th").each((_, el) => {
    $(el).append(" | ");
  });
  return $("body")
    .text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Links inside a notice document page (for finding the PDF / apply link). */
export function documentLinks(html: string, baseUrl: string): { url: string; text: string }[] {
  const $ = cheerio.load(html);
  const out: { url: string; text: string }[] = [];
  // Site-wide menus link generic PDFs ("Exam Schedule", "FAQ") on every page.
  $("nav, header, footer, [role=navigation], .navbar, .menu, .dropdown-menu").remove();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href")!, baseUrl);
      if (u.protocol === "https:" || u.protocol === "http:") out.push({ url: u.toString(), text: clean($(el).text()) ?? "" });
    } catch {
      /* ignore */
    }
  });
  return out;
}
