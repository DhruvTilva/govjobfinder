import type { MetadataRoute } from "next";
import { getDb } from "@/db/client";
import { organizations, qualifications, sectors, states } from "@/db/schema";
import { sitemapEntries } from "@/lib/queries";
import { noticeHref } from "@/lib/status";
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
  const now = new Date();
  const fixed = ["/", "/jobs", "/admit-cards", "/results", "/answer-keys", "/admissions", "/updates", "/states", "/sectors", "/qualifications", "/exams", "/tools/eligibility", "/about", "/faq", "/user-guide", "/privacy-policy", "/terms-of-use", "/disclaimer"];
  return [
    ...fixed.map((p) => ({ url: siteUrl(p), lastModified: now, changeFrequency: "hourly" as const, priority: p === "/" ? 1 : 0.8 })),
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
