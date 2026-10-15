import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganization, parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Nav";
import { Listing } from "@/components/Listing";
import { SourceList } from "@/components/SourceList";
import { getI18n } from "@/lib/i18n-server";
import { sectorName, stateName } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const data = await getOrganization((await params).slug);
  if (!data) notFound();
  const name = data.org.shortName ? `${data.org.name} (${data.org.shortName})` : data.org.name;
  return listingMetadata(
    `/organizations/${data.org.slug}`,
    `${name} Recruitment`,
    `Latest recruitment notices, admit cards and results from ${name}, with official links.`,
    parseFilters(await searchParams),
  );
}

export default async function OrgPage({ params, searchParams }: Props) {
  const data = await getOrganization((await params).slug);
  if (!data) notFound();
  const { t, lang } = await getI18n();
  const { org } = data;
  return (
    <div className="container-page py-6">
      <Breadcrumbs
        items={[
          ...(data.stateSlug ? [{ href: `/states/${data.stateSlug}`, label: stateName(lang, data.stateSlug, data.stateName!) }] : [{ href: "/jobs?state=central", label: t("common.centralGovt") }]),
          { label: org.shortName ?? org.name },
        ]}
      />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{org.name}</h1>
      <p className="mb-5 text-sm text-muted">
        {data.sectorSlug && (
          <Link href={`/sectors/${data.sectorSlug}`} className="hover:underline">
            {sectorName(lang, data.sectorSlug, data.sectorName!)}
          </Link>
        )}
        {data.stateName ? ` · ${stateName(lang, data.stateSlug, data.stateName)}` : ` · ${t("page.org.centralAllIndia")}`}
      </p>
      <Listing filters={parseFilters(await searchParams)} basePath={`/organizations/${org.slug}`} fixed={{ org: org.slug }} />
      <section className="card mt-8 p-5">
        <h2 className="text-xl">{t("page.org.websites")}</h2>
        <SourceList orgs={[{ org, sources: data.sources }]} />
        {org.notes && <p className="mt-2 text-xs text-muted">Note: {org.notes}</p>}
      </section>
    </div>
  );
}
