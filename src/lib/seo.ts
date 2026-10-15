import type { Metadata } from "next";
import { filtersToSearch, type Filters } from "./queries";

/**
 * Listing metadata: the unfiltered listing (and its pages) is indexable with a
 * self canonical; filtered/search variants are noindex to avoid thin duplicates.
 */
export function listingMetadata(path: string, title: string, description: string, f: Filters): Metadata {
  const filtered = Object.entries(f).some(([k, v]) => v !== undefined && k !== "page");
  const canonical = path + (f.page && f.page > 1 ? `?page=${f.page}` : "");
  return {
    title: f.page && f.page > 1 ? `${title} – Page ${f.page}` : title,
    description,
    alternates: { canonical: filtered ? path + filtersToSearch(f) : canonical },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}
