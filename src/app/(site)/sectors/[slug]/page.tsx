import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSector, parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Nav";
import { Listing } from "@/components/Listing";
import { getI18n } from "@/lib/i18n-server";
import { sectorDescription, sectorName, stateName } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const data = await getSector((await params).slug);
  if (!data) notFound();
  return listingMetadata(`/sectors/${data.sector.slug}`, `${data.sector.name} Jobs`, data.sector.description ?? "", parseFilters(await searchParams));
}

export default async function SectorPage({ params, searchParams }: Props) {
  const data = await getSector((await params).slug);
  if (!data) notFound();
  const { t, lang } = await getI18n();
  const { sector, orgs } = data;
  const name = sectorName(lang, sector.slug, sector.name);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ href: "/sectors", label: t("nav.sectors") }, { label: name }]} />
      <h1 className="mb-1 mt-3 text-3xl">{t("page.sector.title", { name })}</h1>
      <p className="mb-5 text-sm text-muted">{sectorDescription(lang, sector.slug, sector.description)}</p>
      <Listing filters={parseFilters(await searchParams)} basePath={`/sectors/${sector.slug}`} fixed={{ sector: sector.slug }} />
      {orgs.length > 0 && (
        <section className="card mt-8 p-5">
          <h2 className="text-xl">{t("page.sector.orgs")}</h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map(({ org, stateName: st }) => (
              <li key={org.id}>
                <Link href={`/organizations/${org.slug}`} className="text-navy-700 hover:underline">
                  {org.shortName ?? org.name}
                </Link>
                {st && <span className="text-muted"> · {stateName(lang, null, st)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
