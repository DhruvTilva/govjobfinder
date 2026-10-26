import type { MetadataRoute } from "next";
import { getDb } from "@/db/client";
import { organizations, qualifications, sectors, states } from "@/db/schema";
import { sitemapEntries } from "@/lib/queries";
import { KIND_PATH, noticeHref } from "@/lib/status";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [notices, st, se, org, qu] = await Promise.all([
    sitemapEntries(),
    db.select({ slug: states.slug }).from(states),
    db.select({ slug: sectors.slug }).from(sectors),
    db.select({ slug: organizations.slug, updatedAt: organizations.updatedAt }).from(organizations),
    db.select({ slug: qualifications.slug }).from(qualifications),
  ]);
  // lastmod must be truthful or Google ignores it: listings take their newest notice, static pages none.
  const latest = notices[0]?.updatedAt;
  const latestByPath = new Map<string, Date>();
  for (const n of notices) if (!latestByPath.has(KIND_PATH[n.kind])) latestByPath.set(KIND_PATH[n.kind], n.updatedAt);
  const listings = ["/", "/jobs", "/admit-cards", "/results", "/answer-keys", "/admissions", "/updates"];
  const hubs = ["/states", "/sectors", "/qualifications", "/exams", "/tools/eligibility"];
  const info = ["/about", "/faq", "/user-guide", "/privacy-policy", "/terms-of-use", "/disclaimer"];
  return [
    ...listings.map((p) => ({ url: siteUrl(p), lastModified: (p === "/" ? latest : latestByPath.get(p)) ?? latest, changeFrequency: "hourly" as const, priority: p === "/" ? 1 : 0.9 })),
    ...hubs.map((p) => ({ url: siteUrl(p), lastModified: latest, changeFrequency: "daily" as const, priority: 0.7 })),
    ...info.map((p) => ({ url: siteUrl(p), changeFrequency: "yearly" as const, priority: 0.3 })),
    ...st.map((s) => ({ url: siteUrl(`/states/${s.slug}`), changeFrequency: "daily" as const, priority: 0.7 })),
    ...se.map((s) => ({ url: siteUrl(`/sectors/${s.slug}`), changeFrequency: "daily" as const, priority: 0.7 })),
    ...qu.map((q) => ({ url: siteUrl(`/qualifications/${q.slug}`), changeFrequency: "daily" as const, priority: 0.6 })),
    ...org.map((o) => ({ url: siteUrl(`/organizations/${o.slug}`), lastModified: o.updatedAt, changeFrequency: "daily" as const, priority: 0.5 })),
    ...notices.map((n) => ({
      url: siteUrl(noticeHref(n)),
      lastModified: n.updatedAt,
      changeFrequency: n.status === "published" ? ("daily" as const) : ("monthly" as const),
      priority: n.status === "published" ? 0.9 : 0.3,
    })),
  ];
}
