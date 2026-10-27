import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";
import { ChevronRight } from "@/components/icons";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <section className="border-b border-line bg-white">
      <div className="container-page flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <p className="text-6xl font-bold text-navy-950 sm:text-7xl">404</p>
        <h1 className="mt-3 text-2xl sm:text-3xl">{t("page.notFound.title")}</h1>
        <p className="mt-2 max-w-md text-muted">{t("page.notFound.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary px-5 py-2.5">
            {t("page.notFound.back")}
          </Link>
          <Link href="/jobs" className="btn-secondary px-5 py-2.5">
            {t("page.notFound.browse")} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
