import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Nav";
import { AccountActions } from "@/components/AccountActions";
import { getI18n } from "@/lib/i18n-server";
import { authEnabled, currentUser } from "@/lib/user-auth";

export const metadata: Metadata = { title: "Your Account", robots: { index: false } };

export default async function AccountPage() {
  if (!authEnabled()) notFound();
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { t } = await getI18n();
  const methods = [user.googleLinked && "Google", user.telegramLinked && (user.telegramUsername ? `Telegram (@${user.telegramUsername})` : "Telegram")].filter(Boolean).join(", ");
  return (
    <div className="container-page max-w-md py-6">
      <Breadcrumbs items={[{ label: t("account.title") }]} />
      <h1 className="mb-4 mt-3 text-3xl font-bold">{t("account.title")}</h1>
      <dl className="card mb-5 space-y-3 p-5 text-sm">
        <div>
          <dt className="text-muted">{t("account.name")}</dt>
          <dd className="font-semibold text-ink">{user.name}</dd>
        </div>
        {user.email && (
          <div>
            <dt className="text-muted">{t("account.email")}</dt>
            <dd className="break-all font-semibold text-ink">{user.email}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">{t("account.method")}</dt>
          <dd className="font-semibold text-ink">{methods}</dd>
        </div>
      </dl>
      <p className="mb-4 text-sm text-muted">{t("auth.savedSynced")}</p>
      <AccountActions />
      <p className="mt-6 text-xs text-muted">{t("account.deleteNote")}</p>
    </div>
  );
}
