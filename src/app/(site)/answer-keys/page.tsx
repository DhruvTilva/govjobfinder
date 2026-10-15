import type { Metadata } from "next";
import { Listing } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Nav";
import { parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n-server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMetadata("/answer-keys", "Answer Keys", "Provisional and final answer keys published on official recruitment websites.", parseFilters(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const { t } = await getI18n();
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("page.keys.title") }]} />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{t("page.keys.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("page.keys.text")}</p>
      <Listing filters={filters} basePath="/answer-keys" kind="answer_key" />
    </div>
  );
}
