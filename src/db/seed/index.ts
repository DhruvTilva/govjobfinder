import { eq } from "drizzle-orm";
import type { DB } from "../client";
import { states, sectors, qualifications, organizations, sources, exams } from "../schema";
import { SECTORS, QUALIFICATIONS } from "./taxonomy";
import { STATES, type BodyCategory } from "./states";
import { CENTRAL_ORGS, STATE_SCOPED_CENTRAL_SLUGS } from "./central";
import { EXAMS } from "./exams";
import { slugify } from "@/lib/text";
import { hostnameOf, isGovDomain } from "@/lib/url";

const CATEGORY_SECTOR: Record<BodyCategory, string> = {
  commission: "state-government",
  board: "state-government",
  police: "police-paramilitary",
  teaching: "teaching",
  health: "medical",
  portal: "state-government",
};

const INTERVAL_BY_PRIORITY: Record<number, number> = { 1: 120, 2: 360, 3: 720 };

/**
 * Inserts reference data that is missing. Existing rows are never overwritten,
 * so edits made in the admin dashboard survive re-seeding.
 */
export async function seedReferenceData(db: DB) {
  const counts = { states: 0, sectors: 0, qualifications: 0, organizations: 0, sources: 0, exams: 0 };

  // Sectors & qualifications
  for (const [i, s] of SECTORS.entries()) {
    const r = await db
      .insert(sectors)
      .values({ slug: s.slug, name: s.name, description: s.description, keywords: s.keywords, sort: i })
      .onConflictDoNothing()
      .returning({ id: sectors.id });
    counts.sectors += r.length;
  }
  for (const q of QUALIFICATIONS) {
    const r = await db.insert(qualifications).values(q).onConflictDoNothing().returning({ id: qualifications.id });
    counts.qualifications += r.length;
  }

  const sectorRows = await db.select({ id: sectors.id, slug: sectors.slug }).from(sectors);
  const sectorId = (slug: string) => sectorRows.find((s) => s.slug === slug)?.id ?? null;

  // States, their bodies and sources
  for (const [i, st] of STATES.entries()) {
    const r = await db
      .insert(states)
      .values({ code: st.code, slug: st.slug, name: st.name, type: st.type, highlights: st.highlights, needsLinkCheck: !!st.needsLinkCheck, sort: i })
      .onConflictDoNothing()
      .returning({ id: states.id });
    counts.states += r.length;
  }
  const stateRows = await db.select({ id: states.id, code: states.code }).from(states);
  const stateId = (code: string) => stateRows.find((s) => s.code === code)?.id ?? null;

  for (const st of STATES) {
    for (const b of st.bodies) {
      const slug = `${st.slug}-${slugify(b.short ?? b.name, 40)}`;
      const host = hostnameOf(b.url)!;
      const orgId = await upsertOrg(db, {
        slug,
        name: b.name,
        shortName: b.short ?? null,
        level: st.type === "ut" ? "ut" : "state",
        stateId: stateId(st.code),
        sectorId: sectorId(CATEGORY_SECTOR[b.category]),
        website: b.url,
        officialDomains: [host],
        referenceSource: "State_Wise_Govt_Jobs_Hub.xlsx",
        notes: b.note ?? null,
      });
      if (orgId.inserted) counts.organizations++;
      const isPortal = b.category === "portal";
      const priority = isPortal ? 3 : 2;
      counts.sources += await insertSource(db, {
        organizationId: orgId.id,
        name: b.short ?? b.name,
        url: b.url,
        scan: b.scan !== false,
        priority,
        trust: !isPortal && isGovDomain(host) ? "trusted" : "review",
        allowedDomains: [host],
      });
    }
  }

  // Central, PSU and autonomous bodies
  for (const o of CENTRAL_ORGS) {
    const host = hostnameOf(o.url)!;
    const domains = [...new Set([host, ...(o.domains ?? [])])];
    const scopedState = STATE_SCOPED_CENTRAL_SLUGS[o.slug];
    const org = await upsertOrg(db, {
      slug: o.slug,
      name: o.name,
      shortName: o.short ?? null,
      level: o.level,
      stateId: scopedState ? stateId(scopedState) : null,
      sectorId: sectorId(o.sector),
      website: o.url,
      officialDomains: domains,
      referenceSource: o.ref
        .split(",")
        .map((r) => ({ sector: "Sector-wise-job.docx", top50: "Top 50 Exams Technical Sector.xlsx", research: "Added after research" })[r] ?? r)
        .join("; "),
      notes: o.note ?? null,
    });
    if (org.inserted) counts.organizations++;
    const priority = o.priority ?? 2;
    counts.sources += await insertSource(db, {
      organizationId: org.id,
      name: o.short ?? o.name,
      url: o.url,
      scan: o.scan !== false,
      priority,
      trust: "trusted",
      allowedDomains: domains,
    });
    for (const extra of o.extraSources ?? []) {
      const h = hostnameOf(extra.url)!;
      counts.sources += await insertSource(db, {
        organizationId: org.id,
        name: extra.name,
        url: extra.url,
        scan: extra.scan !== false,
        priority,
        trust: "trusted",
        allowedDomains: [...new Set([h, ...domains])],
      });
    }
  }

  // Technical exam directory
  const orgRows = await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations);
  for (const e of EXAMS) {
    const r = await db
      .insert(exams)
      .values({
        slug: slugify(e.name),
        name: e.name,
        group: e.group,
        rank: e.rank,
        organizationId: e.org ? orgRows.find((o) => o.slug === e.org)?.id ?? null : null,
        recruitingBody: e.body,
        officialUrl: e.url ?? null,
        typicalWindow: e.window,
        focusAreas: e.focus,
        indicativeSalary: e.salary,
        difficulty: e.difficulty,
        notes: e.note ?? null,
        active: e.active !== false,
      })
      .onConflictDoNothing()
      .returning({ id: exams.id });
    counts.exams += r.length;
  }

  return counts;
}

async function upsertOrg(db: DB, values: typeof organizations.$inferInsert) {
  const inserted = await db.insert(organizations).values(values).onConflictDoNothing().returning({ id: organizations.id });
  if (inserted[0]) return { id: inserted[0].id, inserted: true };
  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, values.slug));
  return { id: existing.id, inserted: false };
}

async function insertSource(
  db: DB,
  s: { organizationId: number; name: string; url: string; scan: boolean; priority: number; trust: "trusted" | "review"; allowedDomains: string[] },
) {
  const r = await db
    .insert(sources)
    .values({
      organizationId: s.organizationId,
      name: s.name,
      url: s.url,
      method: s.scan ? "html_links" : "manual",
      enabled: s.scan,
      priority: s.priority,
      intervalMinutes: INTERVAL_BY_PRIORITY[s.priority] ?? 360,
      trust: s.trust,
      allowedDomains: s.allowedDomains,
      notes: s.scan ? null : "Login/application portal — kept as a reference link, not scanned.",
    })
    .onConflictDoNothing()
    .returning({ id: sources.id });
  return r.length;
}
