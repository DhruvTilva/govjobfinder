import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import { constants as cryptoConstants, X509Certificate } from "node:crypto";
import { Agent, fetch as undiciFetch, type Response } from "undici";

/**
 * Network layer for everything that fetches third-party URLs.
 * - http/https only, default ports only
 * - every resolved IP must be public (checked at connect time → no DNS rebinding)
 * - redirects followed manually and re-validated, max 5
 * - hard timeout and response-size cap
 */

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code: "blocked" | "timeout" | "too_large" | "http" | "network" | "tls" | "robots",
    readonly status?: number,
  ) {
    super(message);
  }
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const blockList = new net.BlockList();
for (const [addr, prefix] of BLOCKED_V4) blockList.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
] as [string, number][])
  blockList.addSubnet(addr, prefix, "ipv6");

export function isPublicIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return false;
  if (family === 6) {
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIp(mapped[1]);
    return !blockList.check(ip, "ipv6");
  }
  return !blockList.check(ip, "ipv4");
}

/** Validates the URL shape before any network activity. */
export function assertFetchableUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new FetchError(`Invalid URL: ${raw}`, "blocked");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new FetchError(`Protocol not allowed: ${u.protocol}`, "blocked");
  if (u.username || u.password) throw new FetchError("Credentials in URL are not allowed", "blocked");
  if (u.port && u.port !== "80" && u.port !== "443") throw new FetchError(`Port not allowed: ${u.port}`, "blocked");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicIp(host)) throw new FetchError(`Address not allowed: ${host}`, "blocked");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new FetchError(`Host not allowed: ${host}`, "blocked");
  return u;
}

const safeLookup: typeof dns.lookup = ((hostname: string, options: dns.LookupOptions, callback: (...a: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicIp(a.address));
    if (bad || list.length === 0) {
      return callback(new FetchError(`Resolved to a non-public address: ${hostname}`, "blocked"));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}) as typeof dns.lookup;

// Many government servers still need legacy renegotiation. This flag only
// restores protocol compatibility; certificate verification stays on.
const SECURE_OPTIONS = cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT;

/** Intermediate certificates fetched via AIA for servers that omit them. */
const extraIntermediates = new Map<string, string>();
let rootCerts: X509Certificate[] | null = null;

function makeAgent() {
  return new Agent({
    connect: {
      lookup: safeLookup,
      timeout: 15_000,
      secureOptions: SECURE_OPTIONS,
      ...(extraIntermediates.size ? { ca: [...tls.rootCertificates, ...extraIntermediates.values()] } : {}),
    },
    headersTimeout: 25_000,
    bodyTimeout: 30_000,
    connections: 4,
  });
}
let agent = makeAgent();

function caIssuerUris(infoAccess: string | undefined): string[] {
  if (!infoAccess) return [];
  return [...infoAccess.matchAll(/CA Issuers - URI:(\S+)/g)].map((m) => m[1]);
}

function issuedByRoot(cert: X509Certificate): boolean {
  rootCerts ??= tls.rootCertificates.map((p) => new X509Certificate(p));
  return rootCerts.some((r) => cert.checkIssued(r));
}

/**
 * Mirrors what browsers do for servers with an incomplete chain: read the leaf
 * certificate's Authority Information Access URL and fetch the missing issuer.
 * The fetched certificate is only trusted for chain building; the chain must
 * still end in a root from Node's store.
 */
const aiaAttempted = new Set<string>();
async function completeChain(host: string): Promise<boolean> {
  if (aiaAttempted.has(host)) return false;
  aiaAttempted.add(host);
  const leaf = await new Promise<X509Certificate>((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false, secureOptions: SECURE_OPTIONS, lookup: safeLookup as never },
      () => {
        const raw = socket.getPeerCertificate(false)?.raw;
        socket.end();
        if (!raw) return reject(new Error("no certificate"));
        resolve(new X509Certificate(raw));
      },
    );
    socket.setTimeout(15_000, () => socket.destroy(new Error("timeout")));
    socket.on("error", reject);
  }).catch(() => null);
  if (!leaf) return false;

  let current = leaf;
  let added = false;
  for (let depth = 0; depth < 3; depth++) {
    const uri = caIssuerUris(current.infoAccess)[0];
    if (!uri) break;
    let issuer: X509Certificate;
    try {
      const res = await safeFetch(uri, { timeoutMs: 15_000, maxBytes: 64 * 1024, accept: "*/*" });
      issuer = new X509Certificate(Buffer.from(res.body));
    } catch {
      break;
    }
    if (!issuer.ca || !current.checkIssued(issuer)) break;
    extraIntermediates.set(issuer.fingerprint256, issuer.toString());
    added = true;
    if (issuedByRoot(issuer)) break;
    current = issuer;
  }
  if (added) agent = makeAgent();
  return added;
}

export const USER_AGENT = process.env.CRAWLER_USER_AGENT || "GovJobFinderBot/1.0 (+https://github.com/govjobfinder)";

export type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: Uint8Array;
  notModified: boolean;
};

export type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  etag?: string | null;
  lastModified?: string | null;
  method?: "GET" | "HEAD";
  accept?: string;
};

export async function safeFetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = assertFetchableUrl(url);

  for (let hop = 0; hop <= 5; hop++) {
    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      accept: opts.accept ?? "text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-IN,en;q=0.9",
    };
    if (hop === 0 && opts.etag) headers["if-none-match"] = opts.etag;
    if (hop === 0 && opts.lastModified) headers["if-modified-since"] = opts.lastModified;

    let res: Response;
    try {
      res = await undiciFetch(current, { method: opts.method ?? "GET", headers, redirect: "manual", signal, dispatcher: agent });
    } catch (e) {
      const fe = classifyError(e);
      if (fe.code === "tls" && /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT/.test(fe.message) && current.protocol === "https:") {
        if (await completeChain(current.hostname)) {
          hop--;
          continue;
        }
      }
      throw fe;
    }

    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new FetchError(`Redirect without location (${res.status})`, "http", res.status);
      current = assertFetchableUrl(new URL(loc, current).toString());
      continue;
    }

    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => (hdrs[k] = v));
    const base = { url, finalUrl: current.toString(), status: res.status, contentType: (hdrs["content-type"] ?? "").toLowerCase(), headers: hdrs };

    if (res.status === 304) {
      await res.body?.cancel();
      return { ...base, body: new Uint8Array(), notModified: true };
    }
    if (res.status >= 400) {
      await res.body?.cancel();
      throw new FetchError(`HTTP ${res.status}`, "http", res.status);
    }
    const declared = Number(hdrs["content-length"] ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel();
      throw new FetchError(`Response too large (${declared} bytes)`, "too_large");
    }
    const body = opts.method === "HEAD" ? new Uint8Array() : await readCapped(res, maxBytes);
    return { ...base, body, notModified: false };
  }
  throw new FetchError("Too many redirects", "http");
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of res.body) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new FetchError(`Response exceeded ${maxBytes} bytes`, "too_large");
      chunks.push(chunk);
    }
  } catch (e) {
    throw classifyError(e);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function classifyError(e: unknown): FetchError {
  if (e instanceof FetchError) return e;
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } & Partial<FetchError> };
  if (err.cause instanceof FetchError) return err.cause;
  const code = err.cause?.code ?? "";
  const msg = err.cause?.message ?? err.message ?? String(e);
  if (err.name === "TimeoutError" || err.name === "AbortError" || /TIMEOUT/i.test(code)) return new FetchError("Timed out", "timeout");
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code + msg)) return new FetchError(`TLS error: ${code || msg}`, "tls");
  return new FetchError(`Network error: ${code || msg}`, "network");
}

export function decodeText(body: Uint8Array, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}
