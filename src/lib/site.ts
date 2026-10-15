export const SITE_NAME = "GovJobFinder";
export const SITE_TAGLINE = "Government job notifications from official sources";

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return base + path;
}
