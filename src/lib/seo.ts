import type { Metadata } from "next";
import { filtersToSearch, type Filters } from "./queries";
import { SITE_DESCRIPTION, SITE_NAME, SUPPORT_EMAIL, siteUrl } from "./site";

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

/* ---------- schema.org ---------- */

/** Stable @ids so every page's JSON-LD points at the same Organization / WebSite nodes. */
export const ORG_ID = siteUrl("/#organization");
export const WEBSITE_ID = siteUrl("/#website");

/**
 * Official social profiles for Organization.sameAs, comma-separated in SITE_SAME_AS.
 * Only real accounts belong here, so it is empty until configured.
 */
function sameAs(): string[] {
  return (process.env.SITE_SAME_AS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function organizationLd() {
  const links = sameAs();
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: siteUrl("/"),
    logo: { "@type": "ImageObject", "@id": siteUrl("/#logo"), url: siteUrl("/logo.png"), contentUrl: siteUrl("/logo.png"), width: 512, height: 512, caption: SITE_NAME },
    image: { "@id": siteUrl("/#logo") },
    description: SITE_DESCRIPTION,
    email: SUPPORT_EMAIL,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, availableLanguage: ["English", "Hindi"] },
    areaServed: { "@type": "Country", name: "India" },
    ...(links.length ? { sameAs: links } : {}),
  };
}

export function websiteLd() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: siteUrl("/"),
    name: SITE_NAME,
    alternateName: [new URL(siteUrl()).hostname.replace(/^www\./, ""), "Govt Job Finder"],
    description: SITE_DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: ["en-IN", "hi-IN"],
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl("/jobs")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Wraps nodes in a single JSON-LD document. */
export function graph(...nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** Plain text → minimal HTML paragraphs (Google renders JobPosting.description as HTML). */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Our qualification slugs → Google's JobPosting credentialCategory values. */
const CREDENTIAL: Record<string, string> = {
  "8th-pass": "high school",
  "10th-pass": "high school",
  "12th-pass": "high school",
  iti: "professional certificate",
  diploma: "associate degree",
  nursing: "associate degree",
  graduate: "bachelor degree",
  btech: "bachelor degree",
  pharmacy: "bachelor degree",
  law: "bachelor degree",
  bed: "bachelor degree",
  "post-graduate": "postgraduate degree",
  "mbbs-medical": "bachelor degree",
  "ca-cma-cs": "professional certificate",
  phd: "postgraduate degree",
};

/** Lowest accepted qualification as an EducationalOccupationalCredential, when mappable. */
export function educationLd(quals: { slug: string }[]) {
  const cat = quals.map((q) => CREDENTIAL[q.slug]).find(Boolean);
  return cat ? { "@type": "EducationalOccupationalCredential", credentialCategory: cat } : undefined;
}
