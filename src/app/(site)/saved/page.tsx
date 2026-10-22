import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Nav";
import { SavedList } from "@/components/SavedList";
import { getI18n } from "@/lib/i18n-server";
import { authEnabled, currentUser } from "@/lib/user-auth";

export const metadata: Metadata = { title: "Saved Jobs", robots: { index: false } };

export default async function SavedPage() {
  const { t } = await getI18n();
  const user = await currentUser();
  if (!user && authEnabled()) redirect("/login?next=/saved");
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t("saved.title") }]} />
      <h1 className="mb-1 mt-3 text-3xl">{t("saved.title")}</h1>
      <p className="mb-5 text-sm text-muted">{user ? t("auth.savedSynced") : t("saved.text")}</p>
      <SavedList />
    </div>
  );
}
