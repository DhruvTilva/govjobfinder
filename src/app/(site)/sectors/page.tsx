import type { Metadata } from "next";
import Link from "next/link";
import { activeCounts, listSectors } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Nav";
import { getI18n } from "@/lib/i18n-server";
import { sectorDescription, sectorName } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Government Jobs by Sector",
  description: "Browse government jobs by sector: UPSC, SSC, railways, banking, defence, police, teaching, medical, engineering, PSUs and more.",
  alternates: { canonical: "/sectors" },
};

export default async function SectorsPage() {
  const [{ t, lang }, rows, counts] = await Promise.all([getI18n(), listSectors(), activeCounts()]);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("nav.sectors") }]} />
      <h1 className="mb-6 mt-3 text-3xl">{t("page.sectors.title")}</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((s) => {
          const n = counts.bySector.get(s.id) ?? 0;
          return (
            <li key={s.id}>
              <Link href={`/sectors/${s.slug}`} className="card block h-full p-4 hover:bg-navy-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{sectorName(lang, s.slug, s.name)}</span>
                  <span className={n ? "chip shrink-0 whitespace-nowrap bg-ok-soft text-ok" : "text-xs text-muted"}>{n ? t("common.active", { n }) : "–"}</span>
                </span>
                <span className="mt-1 block text-sm text-muted">{sectorDescription(lang, s.slug, s.description)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
