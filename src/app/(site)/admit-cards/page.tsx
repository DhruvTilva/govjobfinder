import type { Metadata } from "next";
import { Listing } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Nav";
import { parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n-server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMetadata("/admit-cards", "Admit Cards", "Admit cards, hall tickets and exam city slips published on official recruitment websites.", parseFilters(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const { t } = await getI18n();
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("page.admit.title") }]} />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{t("page.admit.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("page.admit.text")}</p>
      <Listing filters={filters} basePath="/admit-cards" kind="admit_card" />
    </div>
  );
}
