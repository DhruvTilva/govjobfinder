import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";
import { textSizeBootScript } from "@/components/TextSize";
import { getI18n } from "@/lib/i18n-server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Inter has no Devanagari glyphs; Hindi text falls back to Noto Sans Devanagari.
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-devanagari", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description:
    "Latest central and state government job notifications in India, collected from official recruitment websites, with last dates, eligibility and official links.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN" },
  alternates: { types: { "application/rss+xml": siteUrl("/feed.xml") } },
};

export const viewport: Viewport = { themeColor: "#00142f", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getI18n();
  return (
    <html lang={lang === "hi" ? "hi-IN" : "en-IN"} className={`${inter.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <head>
        {/* On the client the script is already executed, so render it inert (avoids React 19's script warning). */}
        <script
          type={typeof window === "undefined" ? undefined : "application/json"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: textSizeBootScript }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
