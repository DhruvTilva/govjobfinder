import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getState, parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Nav";
import { Listing } from "@/components/Listing";
import { SourceList } from "@/components/SourceList";
import { getI18n } from "@/lib/i18n-server";
import { stateName } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const data = await getState((await params).slug);
  if (!data) notFound();
  const name = data.state.name;
  return listingMetadata(
    `/states/${data.state.slug}`,
    `${name} Government Jobs`,
    `Latest ${name} government job notifications and official recruitment websites${data.state.highlights ? ` — ${data.state.highlights}` : ""}.`,
    parseFilters(await searchParams),
  );
}

export default async function StatePage({ params, searchParams }: Props) {
  const data = await getState((await params).slug);
  if (!data) notFound();
  const { t, lang } = await getI18n();
  const { state, orgs } = data;
  const name = stateName(lang, state.slug, state.name);
  const filters = parseFilters(await searchParams);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ href: "/states", label: t("nav.states") }, { label: name }]} />
      <h1 className="mb-1 mt-3 text-3xl">{t("page.state.title", { name })}</h1>
      {state.highlights && <p className="mb-5 text-sm text-muted">{t("page.state.common", { list: state.highlights })}</p>}
      <Listing filters={filters} basePath={`/states/${state.slug}`} fixed={{ state: state.slug }} />
      <section className="card mt-8 p-5">
        <h2 className="text-xl">{t("page.state.websites", { name })}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("page.state.websitesText", { name })}{" "}
          <a href="/jobs?state=central" className="text-navy-700 underline">
            {t("common.centralGovt")}
          </a>
          .
        </p>
        {state.needsLinkCheck && <p className="mt-2 rounded bg-urgent-soft px-3 py-2 text-xs text-ink">{t("page.state.noPortal", { name })}</p>}
        <SourceList orgs={orgs} />
        <p className="mt-3 text-xs text-muted">
          {t("page.state.fallback")}{" "}
          <a href="https://www.ncs.gov.in" className="underline" rel="noopener noreferrer nofollow" target="_blank">
            National Career Service
          </a>
          .
        </p>
      </section>
    </div>
  );
}
