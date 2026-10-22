import "./env";
import { eq, inArray } from "drizzle-orm";
import sharp, { type OverlayOptions } from "sharp";
import { getDb, closeDb } from "@/db/client";
import { organizations, uploads } from "@/db/schema";
import { PoliteFetcher } from "@/pipeline/polite";
import { decodeText } from "@/pipeline/net";
import { mapLimit } from "@/pipeline/validate";
import { findIconCandidates, LogoError, MAX_LOGO_INPUT_BYTES, normalizeLogo } from "@/lib/logos";
import { readUpload, storeBytes } from "@/lib/storage";
import { HIDDEN_LOGO_ORGS, LOGO_PAGES } from "@/db/seed/logos-hidden";

/**
 * Downloads each organisation's logo from its official website (the icon the site declares),
 * re-encodes it and stores it. Logos uploaded by editors and logos marked hidden are never touched.
 *   npx tsx scripts/fetch-logos.ts                 # organisations without a logo, or checked > 30 days ago
 *   npx tsx scripts/fetch-logos.ts --force         # re-check every automatic logo
 *   npx tsx scripts/fetch-logos.ts --org bel,isro  # only these organisations
 *   npx tsx scripts/fetch-logos.ts --sheet out.png # also write a contact sheet of all logos (for review)
 */
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const force = process.argv.includes("--force");
const only = arg("org")?.split(",").map((s) => s.trim()).filter(Boolean);
const sheet = arg("sheet");
const STALE_MS = 30 * 86_400_000;

const db = await getDb();

// Organisations whose logo is the State Emblem of India (use restricted by law) stay hidden.
if (HIDDEN_LOGO_ORGS.length) {
  const hide = await db.select({ logoId: organizations.logoId, logoSource: organizations.logoSource }).from(organizations).where(inArray(organizations.slug, HIDDEN_LOGO_ORGS));
  await db.update(organizations).set({ logoSource: "hidden", logoId: null }).where(inArray(organizations.slug, HIDDEN_LOGO_ORGS));
  const orphans = hide.filter((h) => h.logoId && h.logoSource === "auto").map((h) => h.logoId!);
  if (orphans.length) await db.delete(uploads).where(inArray(uploads.id, orphans));
}

const all = await db.select().from(organizations).where(eq(organizations.active, true));
const todo = all.filter((o) => {
  if (o.logoSource === "admin" || o.logoSource === "hidden") return false;
  if (only) return only.includes(o.slug);
  if (force) return true;
  return !o.logoId || !o.logoCheckedAt || Date.now() - o.logoCheckedAt.getTime() > STALE_MS;
});
console.log(`Checking ${todo.length} organisation(s)…`);

const fetcher = new PoliteFetcher(1000);
const results: { slug: string; ok: boolean; detail: string }[] = [];

function homepage(o: (typeof all)[number]): string | null {
  if (LOGO_PAGES[o.slug]) return LOGO_PAGES[o.slug];
  for (const candidate of [o.website, ...o.officialDomains.map((d) => `https://${d}/`)]) {
    try {
      if (candidate) return new URL("/", candidate).toString();
    } catch {
      /* try next */
    }
  }
  return null;
}

await mapLimit(todo, 8, async (o) => {
  const home = homepage(o);
  const done = async (ok: boolean, detail: string) => {
    results.push({ slug: o.slug, ok, detail });
    await db.update(organizations).set({ logoCheckedAt: new Date() }).where(eq(organizations.id, o.id));
  };
  if (!home) return done(false, "no website");
  let candidates: string[];
  try {
    const page = await fetcher.fetch(home, { maxBytes: 3 * 1024 * 1024, timeoutMs: 30_000 });
    candidates = findIconCandidates(decodeText(page.body, page.contentType), page.finalUrl);
  } catch (e) {
    return done(false, `home page: ${(e as Error).message}`);
  }
  let lastError = "no icon declared";
  for (const url of candidates.slice(0, 6)) {
    try {
      const res = await fetcher.fetch(url, { maxBytes: MAX_LOGO_INPUT_BYTES, timeoutMs: 20_000, accept: "image/*,*/*;q=0.5" });
      const { webp, sourceWidth, sourceHeight } = await normalizeLogo(res.body);
      const saved = await storeBytes(db, { bytes: webp, fileName: `${o.slug}.webp`, contentType: "image/webp", userId: null });
      await db.update(organizations).set({ logoId: saved.id, logoSource: "auto", logoCheckedAt: new Date(), updatedAt: new Date() }).where(eq(organizations.id, o.id));
      // The previous automatic logo is no longer used by anything.
      if (o.logoId && o.logoId !== saved.id && o.logoSource === "auto") await db.delete(uploads).where(eq(uploads.id, o.logoId));
      results.push({ slug: o.slug, ok: true, detail: `${url} (${sourceWidth}×${sourceHeight})` });
      return;
    } catch (e) {
      lastError = e instanceof LogoError ? e.message : (e as Error).message;
    }
  }
  return done(false, lastError);
});

const ok = results.filter((r) => r.ok);
console.log(`\nLogos found: ${ok.length} · not found: ${results.length - ok.length}`);
for (const r of results.sort((a, b) => a.slug.localeCompare(b.slug))) console.log(`${r.ok ? "✓" : "✗"} ${r.slug} — ${r.detail.slice(0, 140)}`);

if (sheet) {
  // Contact sheet of every stored automatic logo, labelled by slug, for visual review.
  const rows = (await db.select({ slug: organizations.slug, logoId: organizations.logoId }).from(organizations).where(eq(organizations.logoSource, "auto"))).filter((r) => r.logoId);
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  const cols = 8;
  const tile = 150;
  const height = Math.ceil(rows.length / cols) * (tile + 24) || 1;
  const composites: OverlayOptions[] = [];
  for (const [i, r] of rows.entries()) {
    const file = await readUpload(db, r.logoId!);
    if (!file) continue;
    const x = (i % cols) * tile;
    const y = Math.floor(i / cols) * (tile + 24);
    composites.push({ input: Buffer.from(file.bytes), left: x + 11, top: y + 4 });
    const label = r.slug.length > 22 ? r.slug.slice(-22) : r.slug;
    composites.push({ input: Buffer.from(`<svg width="${tile}" height="22"><text x="4" y="15" font-size="11" font-family="sans-serif">${label.replace(/&/g, "&amp;")}</text></svg>`), left: x, top: y + tile - 12 });
  }
  await sharp({ create: { width: cols * tile, height, channels: 4, background: "#ffffff" } }).composite(composites).png().toFile(sheet);
  console.log(`\nContact sheet: ${sheet} (${rows.length} logos)`);
}

await closeDb();
process.exit(0);
