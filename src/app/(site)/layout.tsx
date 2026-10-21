import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LangProvider } from "@/components/LangProvider";
import { getI18n } from "@/lib/i18n-server";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

// Pages read live data from the database on every request.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getI18n();
  return (
    <LangProvider lang={lang}>
      <SiteHeader />
      <AnnouncementBanner />
      <main id="main">{children}</main>
      <SiteFooter />
    </LangProvider>
  );
}
