import { safeFetch, decodeText, FetchError, type FetchOptions, type FetchResult } from "./net";

/** Parsed robots.txt rules relevant to our crawler. */
type Rules = { allow: string[]; disallow: string[]; crawlDelayMs?: number };

const BOT_TOKEN = "govjobfinderbot";

export function parseRobots(txt: string): Rules {
  const groups: { agents: string[]; rules: Rules }[] = [];
  let current: { agents: string[]; rules: Rules } | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow" && value) current.rules.disallow.push(value);
    else if (key === "allow" && value) current.rules.allow.push(value);
    else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) current.rules.crawlDelayMs = Math.min(n, 30) * 1000;
    }
  }
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && BOT_TOKEN.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  return (specific ?? star)?.rules ?? { allow: [], disallow: [] };
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const pattern = rule
    .replace(/\$$/, "")
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + pattern + (anchored ? "$" : "")).test(path);
}

export function isAllowedByRobots(rules: Rules, pathAndQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules.disallow) if (ruleMatches(r, pathAndQuery) && (!best || r.length > best.len)) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (ruleMatches(r, pathAndQuery) && (!best || r.length >= best.len)) best = { len: r.length, allow: true };
  return best?.allow ?? true;
}

/**
 * A fetch session for one pipeline run: caches robots.txt per origin and
 * spaces requests to the same host (default 1.5 s, or the site's crawl-delay).
 */
export class PoliteFetcher {
  private robots = new Map<string, Promise<Rules>>();
  private hostChain = new Map<string, Promise<unknown>>();
  private lastHit = new Map<string, number>();
  constructor(private readonly minDelayMs = 1500) {}

  private getRules(origin: string): Promise<Rules> {
    let p = this.robots.get(origin);
    if (!p) {
      p = safeFetch(`${origin}/robots.txt`, { timeoutMs: 12_000, maxBytes: 512 * 1024, accept: "text/plain,*/*" })
        .then((r) => (r.contentType.includes("html") ? { allow: [], disallow: [] } : parseRobots(decodeText(r.body, r.contentType))))
        // Missing / unreachable robots.txt means no restrictions (RFC 9309), except 5xx-style outages
        // which we treat permissively too because the main request will surface the outage.
        .catch(() => ({ allow: [], disallow: [] }));
      this.robots.set(origin, p);
    }
    return p;
  }

  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const u = new URL(url);
    const rules = await this.getRules(u.origin);
    if (!isAllowedByRobots(rules, u.pathname + u.search)) throw new FetchError(`Disallowed by robots.txt: ${u.pathname}`, "robots");
    const delay = Math.max(this.minDelayMs, rules.crawlDelayMs ?? 0);

    // Serialise requests per host.
    const prev = this.hostChain.get(u.host) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      const wait = (this.lastHit.get(u.host) ?? 0) + delay - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await safeFetch(url, opts);
      } finally {
        this.lastHit.set(u.host, Date.now());
      }
    });
    this.hostChain.set(u.host, run);
    return run;
  }
}
