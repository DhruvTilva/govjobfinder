export const SITE_NAME = "GovJobFinder";
/** Public support address, shown in the footer and on the information pages. */
export const SUPPORT_EMAIL = "govjobfinder01@gmail.com";
export const SITE_TAGLINE = "Government job notifications from official sources";

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return base + path;
}
