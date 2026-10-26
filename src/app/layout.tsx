import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";
import { TextSizeBootScript } from "@/components/TextSize";
import { getI18n } from "@/lib/i18n-server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Inter has no Devanagari glyphs; Hindi text falls back to Noto Sans Devanagari.
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-devanagari", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["sarkari naukri", "government jobs", "govt jobs", "latest govt jobs", "admit card", "answer key", "sarkari job", "सरकारी नौकरी"],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "jobs",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN", alternateLocale: ["hi_IN"] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  alternates: { types: { "application/rss+xml": siteUrl("/feed.xml") } },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = { themeColor: "#00142f", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getI18n();
  return (
    <html lang={lang === "hi" ? "hi-IN" : "en-IN"} className={`${inter.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <head>
        <TextSizeBootScript />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
