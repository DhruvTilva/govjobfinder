import Link from "next/link";
import { getDb } from "@/db/client";
import { getSiteSettings } from "@/lib/content";
import { getI18n } from "@/lib/i18n-server";
import { safeHref } from "@/lib/url";

/** Site-wide notice set by editors in Website content → Homepage & site settings. */
export async function AnnouncementBanner() {
  const { announcement: a } = await getSiteSettings(await getDb());
  if (!a?.active || !a.text) return null;
  const { lang } = await getI18n();
  const text = lang === "hi" && a.textHi ? a.textHi : a.text;
  const cls = a.tone === "urgent" ? "bg-urgent-soft text-ink" : "bg-navy-50 text-navy-900";
  const internal = a.url?.startsWith("/") && !a.url.startsWith("//");
  const href = internal ? a.url : safeHref(a.url);
  return (
    <div className={`border-b border-line ${cls}`} role="status">
      <p className="container-page py-2 text-sm font-semibold">
        {href ? (
          internal ? (
            <Link href={href} className="hover:underline">
              {text} →
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {text} ↗
            </a>
          )
        ) : (
          text
        )}
      </p>
    </div>
  );
}
