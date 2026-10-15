import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl">{t("page.notFound.title")}</h1>
      <p className="mt-2 text-muted">{t("page.notFound.text")}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/jobs" className="btn-primary">
          {t("page.notFound.browse")}
        </Link>
        <Link href="/" className="btn-secondary">
          {t("common.home")}
        </Link>
      </div>
    </div>
  );
}
