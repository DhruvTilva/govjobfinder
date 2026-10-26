export const SITE_NAME = "GovJobFinder";
/** Public support address, shown in the footer and on the information pages. */
export const SUPPORT_EMAIL = "govjobfinder01@gmail.com";
export const SITE_TAGLINE = "Government job notifications from official sources";
/** Google Tag Manager container (override with NEXT_PUBLIC_GTM_ID; set it empty to disable). */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-T6T2QL7P";
export const SITE_DESCRIPTION =
  "Latest central and state government job notifications in India (Sarkari Naukri), results, admit cards and answer keys, collected from official recruitment websites with last dates, eligibility and official links.";

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return base + path;
}
