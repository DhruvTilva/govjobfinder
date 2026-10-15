import { createHash } from "node:crypto";

export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength).replace(/-+$/g, "") || "item";
}

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Collapses whitespace and trims; returns null for empty strings. */
export function clean(input: string | null | undefined): string | null {
  if (input == null) return null;
  const v = input.replace(/\s+/g, " ").trim();
  return v.length ? v : null;
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "under", "with", "against", "regarding"]);

/**
 * Makes notice titles readable: collapses whitespace and converts SHOUTED titles
 * to title case, keeping short all-caps tokens (UPSC, SSC, JE, PGT) as acronyms.
 */
export function tidyTitle(input: string): string {
  const t = input.replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 12 || t.replace(/[^A-Z]/g, "").length / letters.length < 0.7) return t;
  return t
    .split(" ")
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (bare.length <= 4 && !SMALL_WORDS.has(bare.toLowerCase())) return w; // acronym
      const lower = w.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(bare.toLowerCase())) return lower;
      return lower.replace(/[a-z]/, (c) => c.toUpperCase());
    })
    .join(" ");
}

/** Heuristic for titles stitched together from several labels ("ResultsLDE Results"). */
export function looksGarbled(title: string): boolean {
  const glued = (title.match(/[a-z]{2}[A-Z][a-z]/g) ?? []).length;
  const words = title.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return glued >= 1 || [...counts.values()].some((c) => c >= 3);
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
}
