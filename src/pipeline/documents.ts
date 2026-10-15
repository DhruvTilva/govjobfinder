import { decodeText, type FetchResult } from "./net";
import type { PoliteFetcher } from "./polite";
import { htmlToText, documentLinks } from "./harvest";
import { sha256 } from "@/lib/text";

export type FetchedDocument = {
  url: string;
  finalUrl: string;
  contentType: "pdf" | "html" | "other";
  hash: string;
  text: string;
  /** For HTML pages: the first linked PDF (often the actual notification). */
  pdfLinks: { url: string; text: string }[];
  /** Links that look like an online application. */
  applyLinks: { url: string; text: string }[];
};

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function kindOf(r: FetchResult): FetchedDocument["contentType"] {
  const ct = r.contentType;
  if (ct.includes("pdf") || /\.pdf($|\?)/i.test(r.finalUrl)) return "pdf";
  if (ct.includes("html") || ct.includes("xml") || ct === "") return "html";
  return "other";
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 });
  // First 12 pages carry the facts in practically every notice; keeps memory and time bounded.
  const pages = Math.min(pdf.numPages, 12);
  const out: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join(""));
  }
  return out.join("\n").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export async function fetchDocument(fetcher: PoliteFetcher, url: string): Promise<FetchedDocument> {
  const r = await fetcher.fetch(url, { maxBytes: MAX_PDF_BYTES, timeoutMs: 45_000 });
  const contentType = kindOf(r);
  const hash = sha256(r.body);
  if (contentType === "pdf") {
    let text = "";
    try {
      text = await pdfToText(r.body);
    } catch {
      text = "";
    }
    return { url, finalUrl: r.finalUrl, contentType, hash, text, pdfLinks: [], applyLinks: [] };
  }
  if (contentType === "html") {
    const html = decodeText(r.body, r.contentType);
    const links = documentLinks(html, r.finalUrl);
    return {
      url,
      finalUrl: r.finalUrl,
      contentType,
      hash,
      text: htmlToText(html),
      pdfLinks: links.filter((l) => /\.pdf($|\?)/i.test(l.url)),
      applyLinks: links.filter((l) => /apply\s*online|online\s*application|registration|apply\s*now/i.test(l.text)),
    };
  }
  return { url, finalUrl: r.finalUrl, contentType, hash, text: "", pdfLinks: [], applyLinks: [] };
}
