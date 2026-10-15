import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQualification, parseFilters } from "@/lib/queries";
import { listingMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Nav";
import { Listing } from "@/components/Listing";
import { getI18n } from "@/lib/i18n-server";
import { qualName } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const q = await getQualification((await params).slug);
  if (!q) notFound();
  return listingMetadata(
    `/qualifications/${q.slug}`,
    `Government Jobs for ${q.name}`,
    `Latest government jobs for ${q.name} candidates, from official recruitment websites.`,
    parseFilters(await searchParams),
  );
}

export default async function QualificationPage({ params, searchParams }: Props) {
  const q = await getQualification((await params).slug);
  if (!q) notFound();
  const { t, lang } = await getI18n();
  const name = qualName(lang, q.slug, q.name);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ href: "/qualifications", label: t("list.qual") }, { label: name }]} />
      <h1 className="mb-1 mt-3 text-3xl">{t("page.qual.title", { name })}</h1>
      <p className="mb-5 text-sm text-muted">{t("page.qual.text", { name })}</p>
      <Listing filters={parseFilters(await searchParams)} basePath={`/qualifications/${q.slug}`} fixed={{ qual: q.slug }} />
    </div>
  );
}
