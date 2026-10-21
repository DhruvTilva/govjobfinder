import sharp, { type Metadata, type Sharp } from "sharp";
import * as cheerio from "cheerio";

/**
 * Organisation logos: finding the icon an official website declares, and turning any accepted
 * image into one safe, uniform format. Every logo is decoded and re-encoded (128×128 WebP,
 * transparent padding), so nothing from the source file — SVG scripts, metadata, oversized
 * dimensions — survives into what we serve.
 */
export const LOGO_SIZE = 128;
export const MAX_LOGO_INPUT_BYTES = 1024 * 1024;

export class LogoError extends Error {}

type Candidate = { url: string; size: number; kind: "apple" | "icon" | "header" | "fallback" };

const RANK: Record<Candidate["kind"], number> = { apple: 0, icon: 0, header: 1, fallback: 2 };

/** Icon URLs declared by a page, best first: apple-touch-icon, then larger `sizes`, then favicon.ico. */
export function findIconCandidates(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const out: Candidate[] = [];
  $("link[rel][href]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (!/(^|\s)(apple-touch-icon(-precomposed)?|icon|shortcut icon)(\s|$)/.test(rel)) return;
    const href = $(el).attr("href")!;
    const sizes = ($(el).attr("sizes") ?? "").match(/(\d+)x(\d+)/);
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return;
      out.push({ url: url.toString(), size: sizes ? Number(sizes[1]) : rel.includes("apple") ? 180 : /\.svg($|\?)/i.test(url.pathname) ? 512 : 32, kind: rel.includes("apple") ? "apple" : "icon" });
    } catch {
      /* ignore malformed href */
    }
  });
  // Many government sites declare no icon but show their logo as an image in the page header.
  $("img[src]").each((i, el) => {
    if (i > 40) return false;
    const img = $(el);
    const hint = `${img.attr("class") ?? ""} ${img.attr("id") ?? ""} ${img.attr("alt") ?? ""} ${img.attr("src") ?? ""} ${img.parent().attr("class") ?? ""}`.toLowerCase();
    if (!/logo/.test(hint) || /footer|partner|digital[-_ ]?india|g20|azadi|swachh|mygov|make[-_ ]?in[-_ ]?india/.test(hint)) return;
    try {
      const url = new URL(img.attr("src")!, pageUrl);
      if (url.protocol === "https:" || url.protocol === "http:") out.push({ url: url.toString(), size: 64, kind: "header" });
    } catch {
      /* ignore */
    }
  });
  const origin = new URL(pageUrl).origin;
  out.push({ url: `${origin}/apple-touch-icon.png`, size: 180, kind: "fallback" }, { url: `${origin}/favicon.ico`, size: 16, kind: "fallback" });
  const seen = new Set<string>();
  return out
    // Declared icons (largest first), then header logo images (page order), then well-known paths.
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.kind === "header" ? 0 : b.size - a.size))
    .map((c) => c.url)
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
}

/**
 * Reads a Windows .ico (which sharp cannot decode) and returns its largest image: either an
 * embedded PNG, or a 24/32-bit bitmap converted to raw RGBA.
 */
export function decodeIco(buf: Buffer): { png: Buffer } | { raw: Buffer; width: number; height: number } | null {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  let best: { w: number; size: number; offset: number } | null = null;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    if (e + 16 > buf.length) break;
    const w = buf[e] || 256;
    const size = buf.readUInt32LE(e + 8);
    const offset = buf.readUInt32LE(e + 12);
    if (offset + size > buf.length) continue;
    if (!best || w > best.w) best = { w, size, offset };
  }
  if (!best) return null;
  const img = buf.subarray(best.offset, best.offset + best.size);
  if (img.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { png: Buffer.from(img) };
  // BITMAPINFOHEADER: height is doubled (XOR image + AND mask); rows are bottom-up BGR(A).
  const headerSize = img.readUInt32LE(0);
  const width = img.readInt32LE(4);
  const height = Math.abs(img.readInt32LE(8)) / 2;
  const bpp = img.readUInt16LE(14);
  if ((bpp !== 32 && bpp !== 24) || width <= 0 || height <= 0 || width > 512 || height > 512) return null;
  const rowBytes = Math.ceil((width * bpp) / 32) * 4;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = headerSize + (height - 1 - y) * rowBytes;
    for (let x = 0; x < width; x++) {
      const p = src + x * (bpp / 8);
      if (p + 2 >= img.length) return null;
      const o = (y * width + x) * 4;
      raw[o] = img[p + 2];
      raw[o + 1] = img[p + 1];
      raw[o + 2] = img[p];
      raw[o + 3] = bpp === 32 ? img[p + 3] : 255;
    }
  }
  return { raw, width, height };
}

const isSvg = (buf: Buffer) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(buf.subarray(0, 2048).toString("utf8"));

/**
 * Validates and re-encodes a logo. Rejects non-images, tiny icons (under 32 px) and blank or
 * single-colour images. Returns a 128×128 WebP.
 */
export async function normalizeLogo(input: Uint8Array): Promise<{ webp: Buffer; sourceWidth: number; sourceHeight: number }> {
  const buf = Buffer.from(input);
  if (buf.length === 0) throw new LogoError("Empty file.");
  if (buf.length > MAX_LOGO_INPUT_BYTES) throw new LogoError("Logo file is larger than 1 MB.");
  let img: Sharp;
  const ico = decodeIco(buf);
  if (ico) img = "png" in ico ? sharp(ico.png) : sharp(ico.raw, { raw: { width: ico.width, height: ico.height, channels: 4 } });
  else if (isSvg(buf)) img = sharp(buf, { density: 300 });
  else img = sharp(buf, { failOn: "error", limitInputPixels: 4096 * 4096 });
  let meta: Metadata;
  try {
    meta = await img.metadata();
  } catch {
    throw new LogoError("Not a supported image (PNG, JPEG, GIF, WebP, SVG or ICO).");
  }
  if (meta.format && !["png", "jpeg", "gif", "webp", "svg", "raw"].includes(meta.format) && !ico) throw new LogoError(`Unsupported image format: ${meta.format}.`);
  const w = ico && "raw" in ico ? ico.width : (meta.width ?? 0);
  const h = ico && "raw" in ico ? ico.height : (meta.height ?? 0);
  if (meta.format !== "svg" && (w < 32 || h < 32)) throw new LogoError(`Image is too small (${w}×${h}); at least 32×32 is needed.`);
  // Wide banners (logo plus long name) become unreadable in a square badge.
  if (w && h && Math.max(w / h, h / w) > 3) throw new LogoError(`Image is a banner (${w}×${h}), not a logo.`);
  const resized = img.resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha();
  const stats = await resized.clone().stats();
  const visible = stats.channels[3] ? stats.channels[3].mean > 8 : true;
  const variation = Math.max(...stats.channels.slice(0, 3).map((c: { stdev: number }) => c.stdev));
  if (!visible || variation < 4) throw new LogoError("Image is blank or a single colour.");
  const webp = await resized.webp({ quality: 90 }).toBuffer();
  return { webp, sourceWidth: w, sourceHeight: h };
}
