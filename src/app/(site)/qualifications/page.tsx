import type { Metadata } from "next";
import Link from "next/link";
import { getFilterOptions } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Nav";
import { getI18n } from "@/lib/i18n-server";
import { qualName } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Government Jobs by Qualification",
  description: "Find government jobs for 10th pass, 12th pass, ITI, diploma, graduates, engineers, post-graduates, nurses and more.",
  alternates: { canonical: "/qualifications" },
};

export default async function QualificationsPage() {
  const [{ t, lang }, { qualifications }] = await Promise.all([getI18n(), getFilterOptions()]);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("list.qual") }]} />
      <h1 className="mb-2 mt-3 text-3xl">{t("page.quals.title")}</h1>
      <p className="mb-6 text-sm text-muted">{t("page.quals.text")}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {qualifications.map((q) => (
          <li key={q.slug}>
            <Link href={`/qualifications/${q.slug}`} className="card block p-4 font-semibold text-ink hover:bg-navy-50">
              {t("page.qual.jobs", { name: qualName(lang, q.slug, q.name) })}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
