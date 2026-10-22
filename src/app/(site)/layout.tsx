import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LangProvider } from "@/components/LangProvider";
import { getI18n } from "@/lib/i18n-server";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { SavedSync } from "@/components/SavedSync";
import { AuthProvider } from "@/components/AuthProvider";
import { authEnabled, currentUser } from "@/lib/user-auth";

// Pages read live data from the database on every request.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ lang }, user] = await Promise.all([getI18n(), currentUser()]);
  return (
    <LangProvider lang={lang}>
      <AuthProvider enabled={authEnabled()} userId={user?.id ?? null}>
        <SavedSync userId={user?.id ?? null} />
        <SiteHeader />
        <AnnouncementBanner />
        <main id="main">{children}</main>
        <SiteFooter />
      </AuthProvider>
    </LangProvider>
  );
}
