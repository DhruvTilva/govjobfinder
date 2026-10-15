import type { Metadata } from "next";
import Link from "next/link";
import { activeCounts, listStates } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Nav";
import { getI18n } from "@/lib/i18n-server";
import { stateName } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "State-wise Government Jobs",
  description: "Government job notifications for all 28 states and 8 Union Territories of India, with official recruitment websites for each.",
  alternates: { canonical: "/states" },
};

export default async function StatesPage() {
  const [{ t, lang }, rows, counts] = await Promise.all([getI18n(), listStates(), activeCounts()]);
  const group = (type: "state" | "ut") => rows.filter((r) => r.type === type);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("nav.states") }]} />
      <h1 className="mb-1 mt-3 text-3xl">{t("page.states.title")}</h1>
      <p className="mb-6 text-sm text-muted">{t("page.states.text")}</p>
      {(["state", "ut"] as const).map((type) => (
        <section key={type} className="mb-8">
          <h2 className="mb-3 text-xl">{type === "state" ? t("page.states.states") : t("page.states.uts")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group(type).map((s) => {
              const n = counts.byState.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <Link href={`/states/${s.slug}`} className="card block h-full p-3.5 hover:bg-navy-50">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{stateName(lang, s.slug, s.name)}</span>
                      <span className={n ? "chip bg-ok-soft text-ok" : "text-xs text-muted"}>{n ? t("common.active", { n }) : "–"}</span>
                    </span>
                    {s.highlights && <span className="mt-1 line-clamp-2 block text-xs text-muted">{s.highlights}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
