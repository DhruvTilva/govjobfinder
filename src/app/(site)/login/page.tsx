import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Nav";
import { LoginPanel } from "@/components/LoginPanel";
import { getI18n } from "@/lib/i18n-server";
import { authEnabled, currentUser, googleEnabled, safeNext, telegramEnabled } from "@/lib/user-auth";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  if (!authEnabled()) notFound();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(first(sp.next));
  if (await currentUser()) redirect(next);
  const { t } = await getI18n();
  return (
    <div className="container-page max-w-md py-6">
      <Breadcrumbs items={[{ label: t("auth.login") }]} />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{t("auth.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("auth.intro")}</p>
      <div className="card p-5">
        <LoginPanel google={googleEnabled()} telegram={telegramEnabled()} next={next} error={first(sp.error)} />
      </div>
    </div>
  );
}
