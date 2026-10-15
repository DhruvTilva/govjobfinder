import Link from "next/link";
import type { NoticeCard as Card } from "@/lib/queries";
import { daysLeft, displayStatus, noticeHref, STATUS_STYLE, type DisplayStatus } from "@/lib/status";
import { safeHref } from "@/lib/url";
import { getI18n } from "@/lib/i18n-server";
import { formatDateL, qualName, stateName, type Lang, type MessageKey, type T } from "@/lib/i18n";
import { ChevronRight, DocIcon } from "./icons";
import { SaveButton } from "./SaveButton";

export async function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = await getI18n();
  return <span className={`chip ${STATUS_STYLE[status].cls}`}>{t(`status.${status}` as MessageKey)}</span>;
}

/** Square badge with the organisation's acronym (or initials). */
export function OrgBadge({ short, name, size = "md", tone = "default" }: { short: string | null; name: string | null; size?: "sm" | "md"; tone?: "default" | "urgent" }) {
  const raw = short ?? name ?? "";
  const label = (short ? short.replace(/\s*\(.*\)$/, "") : raw.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("")).slice(0, 5) || "—";
  const dim = size === "sm" ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[10px]";
  const color = tone === "urgent" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-line-strong bg-slate-100 text-brand";
  return (
    <span aria-hidden className={`flex ${dim} shrink-0 items-center justify-center rounded border font-mono font-bold tracking-tight ${color}`}>
      {label}
    </span>
  );
}

/** Parses "slug:name|slug:name" into display names in the current language. */
export function qualList(raw: string | null, lang: Lang): string | null {
  if (!raw) return null;
  return raw
    .split("|")
    .map((p) => {
      const i = p.indexOf(":");
      return qualName(lang, p.slice(0, i), p.slice(i + 1));
    })
    .join(", ");
}

export const placeOf = (n: Card, lang: Lang, t: T) => (n.stateName ? stateName(lang, n.stateSlug, n.stateName) : n.isCentral ? t("common.allIndia") : null);

/**
 * One recruitment or update, laid out as a dense row: identity and key facts on
 * the left; last date and the official-notice / details actions on the right.
 */
export async function JobRow({ n, today }: { n: Card; today: string }) {
  const { t, lang } = await getI18n();
  const ds = displayStatus(n, today);
  const isJob = n.kind === "recruitment";
  const left = daysLeft(n.applyEnd, today);
  const urgent = isJob && ds === "closing";
  const pdf = safeHref(n.notificationUrl);
  const quals = qualList(n.quals, lang);
  const place = placeOf(n, lang, t);
  const age = n.ageMin || n.ageMax ? t("row.ageVal", { a: n.ageMin ?? "—", b: n.ageMax ?? "—" }) : null;
  const dueLabel = !isJob
    ? t(`kind.${n.kind}` as MessageKey)
    : urgent && left != null
      ? left === 0
        ? t("row.closesToday")
        : t("row.closingIn", { n: left })
      : t("row.lastDate");

  return (
    <article
      className={`flex flex-col gap-3 rounded-md border p-3.5 shadow-sm transition-all hover:shadow-md md:flex-row md:items-center ${
        urgent ? "border-amber-300 bg-amber-50/50 hover:border-amber-500" : "border-line-strong bg-white hover:border-brand"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <OrgBadge short={n.orgShort} name={n.orgName} tone={urgent ? "urgent" : "default"} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {!isJob && <span className="tag bg-brand-soft uppercase text-brand">{t(`kind.${n.kind}` as MessageKey)}</span>}
            {isJob && ds !== "open" && <span className={`tag uppercase ${STATUS_STYLE[ds].cls}`}>{t(`status.${ds}` as MessageKey)}</span>}
            {n.advtNo && isJob && <span className="tag max-w-56 truncate bg-slate-100 uppercase text-slate-700">{n.advtNo}</span>}
            {n.totalPosts != null && isJob && <span className="tag bg-ok-soft text-ok">{t("common.posts", { n: n.totalPosts.toLocaleString("en-IN") })}</span>}
            <span className="min-w-0 truncate text-[11px] text-muted">{[n.orgName, place].filter(Boolean).join(" · ")}</span>
          </div>
          <h3 className="text-sm font-bold leading-snug tracking-normal text-ink">
            <Link href={noticeHref(n)} className="line-clamp-2 hover:text-brand hover:underline">
              {n.title}
            </Link>
          </h3>
          {isJob && (quals || age || n.jobType !== "unknown") && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
              {quals && (
                <span>
                  <strong className="font-semibold text-body">{t("row.eligibility")}:</strong> {quals}
                </span>
              )}
              {age && (
                <span>
                  <strong className="font-semibold text-body">{t("row.age")}:</strong> {age}
                </span>
              )}
              {n.jobType !== "unknown" && (
                <span>
                  <strong className="font-semibold text-body">{t("card.jobType")}:</strong> {t(`jobType.${n.jobType}` as MessageKey)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className={`flex shrink-0 items-center justify-between gap-3 border-t pt-2.5 md:flex-col md:items-end md:justify-center md:border-t-0 md:pt-0 ${urgent ? "border-amber-200" : "border-slate-100"}`}>
        <div className="text-left md:text-right">
          <span className={`block text-[10px] font-bold uppercase tracking-wide ${urgent ? "text-danger" : "text-slate-400"}`}>{dueLabel}</span>
          <span className={`font-mono text-xs font-bold ${urgent ? "text-danger" : "text-ink"}`}>
            {isJob ? (n.applyEnd ? formatDateL(n.applyEnd, lang) : <span className="font-sans font-medium italic text-muted">{t("common.notStated")}</span>) : formatDateL((n.publishedAt ?? n.firstSeenAt).toISOString(), lang)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SaveButton item={{ slug: n.slug, kind: n.kind, title: n.title, applyEnd: n.applyEnd, org: n.orgShort ?? n.orgName }} compact />
          {pdf && (
            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 rounded border border-line-strong bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-200"
              aria-label={`${t("common.officialNotice")}: ${n.title}`}
            >
              <DocIcon className="h-3.5 w-3.5 text-danger" /> PDF
            </a>
          )}
          <Link
            href={noticeHref(n)}
            className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-bold text-white shadow-sm ${urgent ? "bg-saffron-dark hover:bg-amber-700" : "bg-brand hover:bg-brand-hover"}`}
          >
            {t("common.details")} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export async function NoticeGrid({ items, today, empty }: { items: Card[]; today: string; empty?: React.ReactNode }) {
  if (!items.length) return <div className="card p-8 text-center text-muted">{empty}</div>;
  return (
    <div className="space-y-2.5">
      {items.map((n) => (
        <JobRow key={n.id} n={n} today={today} />
      ))}
    </div>
  );
}
