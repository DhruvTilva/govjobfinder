/** Domain suffixes we treat as Government of India official domains. */
export const GOV_SUFFIXES = ["gov.in", "nic.in"] as const;

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when `host` equals `domain` or is a subdomain of it. */
export function hostMatches(host: string, domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return host === d || host.endsWith("." + d);
}

export function isGovDomain(host: string): boolean {
  return GOV_SUFFIXES.some((s) => hostMatches(host, s));
}

/**
 * Official if the link is on a .gov.in / .nic.in domain or on one of the
 * organisation's own registered domains.
 */
export function isOfficialUrl(url: string, orgDomains: readonly string[] = []): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return isGovDomain(host) || orgDomains.some((d) => hostMatches(host, d));
}

/**
 * Normalises a URL for duplicate detection: lower-case host, no www, no
 * fragment, no tracking params, sorted query, no trailing slash.
 */
export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = "";
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !/^(utm_|fbclid|gclid)/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of params) u.searchParams.append(k, v);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString().replace(/^http:/, "https:");
}

/** Only allow http(s) URLs through to rendered hrefs. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
