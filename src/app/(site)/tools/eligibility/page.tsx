import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Nav";
import { EligibilityCalculator } from "@/components/EligibilityCalculator";
import { getI18n } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Age Eligibility Calculator for Government Jobs",
  description: "Calculate your exact age on a notice's cut-off date and check the upper age limit with OBC, SC/ST and PwBD relaxation.",
  alternates: { canonical: "/tools/eligibility" },
};

export default async function EligibilityPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("age.title") }]} />
      <h1 className="mb-2 mt-3 text-3xl">{t("age.title")}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted">{t("age.intro")}</p>
      <EligibilityCalculator />
    </div>
  );
}
