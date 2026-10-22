import { describe, it, expect } from "vitest";
import { assertFetchableUrl, isPublicIp, safeFetch } from "@/pipeline/net";
import { isAllowedByRobots, parseRobots } from "@/pipeline/polite";
import { isOfficialUrl, normalizeUrl, safeHref } from "@/lib/url";
import { slugify } from "@/lib/text";

describe("SSRF guard", () => {
  it("classifies private and public addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
    for (const ip of ["8.8.8.8", "164.100.1.1", "2606:4700::1111"]) expect(isPublicIp(ip), ip).toBe(true);
  });
  it("rejects unsafe URL shapes before any network access", () => {
    for (const u of ["file:///etc/passwd", "ftp://ssc.gov.in", "http://127.0.0.1/", "http://[::1]/", "http://localhost/", "https://ssc.gov.in:8443/", "https://user:pw@ssc.gov.in/", "javascript:alert(1)"]) {
      expect(() => assertFetchableUrl(u), u).toThrow();
    }
    expect(assertFetchableUrl("https://ssc.gov.in/notices").hostname).toBe("ssc.gov.in");
  });
  it("refuses hostnames that resolve to private addresses (checked at connect time)", async () => {
    // localtest.me resolves to 127.0.0.1 via public DNS; skip when DNS is unavailable.
    // Its lookup alone can take ~4 s on some resolvers, so leave room under parallel test load.
    await expect(safeFetch("http://localtest.me/", { timeoutMs: 20_000 })).rejects.toMatchObject({ code: expect.stringMatching(/blocked|network/) });
  }, 30_000);
});

describe("robots.txt", () => {
  const rules = parseRobots(`
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /Portals/0/
Allow: /Portals/0/public/
Disallow: /*.php$
Crawl-delay: 5
`);
  it("applies the wildcard group with longest-match precedence", () => {
    expect(isAllowedByRobots(rules, "/Portals/0/notice.pdf")).toBe(false);
    expect(isAllowedByRobots(rules, "/Portals/0/public/notice.pdf")).toBe(true);
    expect(isAllowedByRobots(rules, "/index.php")).toBe(false);
    expect(isAllowedByRobots(rules, "/index.php?x=1")).toBe(true);
    expect(isAllowedByRobots(rules, "/recruitment")).toBe(true);
    expect(rules.crawlDelayMs).toBe(5000);
  });
  it("treats an empty file as allow-all", () => {
    expect(isAllowedByRobots(parseRobots(""), "/anything")).toBe(true);
  });
});

describe("URL helpers", () => {
  it("normalises URLs for duplicate detection", () => {
    expect(normalizeUrl("http://WWW.SSC.gov.in/a/b/?utm_source=x&b=2&a=1#top")).toBe("https://ssc.gov.in/a/b?a=1&b=2");
  });
  it("recognises official domains", () => {
    expect(isOfficialUrl("https://bpsc.bihar.gov.in/x.pdf")).toBe(true);
    expect(isOfficialUrl("https://jkpsc.nic.in/")).toBe(true);
    expect(isOfficialUrl("https://www.ibps.in/x", ["ibps.in"])).toBe(true);
    expect(isOfficialUrl("https://ibps.in.evil.com/x", ["ibps.in"])).toBe(false);
    expect(isOfficialUrl("https://gov.in.example.com/")).toBe(false);
  });
  it("only renders http(s) hrefs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://ssc.gov.in/x")).toBe("https://ssc.gov.in/x");
  });
  it("makes stable slugs", () => {
    expect(slugify("Recruitment of JE (Civil) & AE — 2026!")).toBe("recruitment-of-je-civil-and-ae-2026");
  });
});

describe("certificate bundles and failure reporting", async () => {
  const tls = await import("node:tls");
  const { X509Certificate } = await import("node:crypto");
  const { certificatesFrom, FetchError } = await import("@/pipeline/net");
  const { urlStatusFor, describeFailure } = await import("@/pipeline/run");

  it("reads a single DER certificate and certificates embedded in a PKCS#7 (.p7c) bundle", () => {
    const der = (pem: string) => new X509Certificate(pem).raw;
    const [a, b] = [der(tls.rootCertificates[0]), der(tls.rootCertificates[1])];
    expect(certificatesFrom(a)).toHaveLength(1);
    // PKCS#7 SignedData wrapper bytes around two certificates, as emSign serves them.
    const header = Buffer.from([0x30, 0x82, 0x0f, 0x00, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02, 0xa0, 0x82, 0x0e, 0x00]);
    const found = certificatesFrom(Buffer.concat([header, a, b, Buffer.from([0x31, 0x00])]));
    expect(found.map((c) => c.fingerprint256)).toEqual([new X509Certificate(a).fingerprint256, new X509Certificate(b).fingerprint256]);
    expect(certificatesFrom(Buffer.from("not a certificate"))).toEqual([]);
  });

  it("separates deliberate blocks from breakage and explains the error", () => {
    expect(urlStatusFor(new FetchError("HTTP 403", "http", 403))).toBe("blocked");
    expect(urlStatusFor(new FetchError("Disallowed by robots.txt: /", "robots"))).toBe("blocked");
    expect(urlStatusFor(new FetchError("Timed out", "timeout"))).toBe("timeout");
    expect(urlStatusFor(new FetchError("HTTP 404", "http", 404))).toBe("broken");
    expect(describeFailure(new FetchError("HTTP 403", "http", 403))).toBe("http: HTTP 403 (the site refuses automated access)");
    expect(describeFailure(new FetchError("TLS error: CERT_HAS_EXPIRED", "tls"))).toContain("certificate has expired");
    expect(describeFailure(new FetchError("Network error: ENOTFOUND", "network"))).toContain("domain does not exist");
  });
});
