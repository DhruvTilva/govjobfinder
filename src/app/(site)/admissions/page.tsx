import type { Metadata } from "next";
import { Listing } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Nav";
import { parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n-server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMetadata("/admissions", "Admissions", "Admission notices, entrance exams and counselling for courses, from official websites.", parseFilters(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const { t } = await getI18n();
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("page.admissions.title") }]} />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{t("page.admissions.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("page.admissions.text")}</p>
      <Listing filters={filters} basePath="/admissions" kind="admission" />
    </div>
  );
}
