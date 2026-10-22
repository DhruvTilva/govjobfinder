"use client";

import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./LangProvider";
import type { MessageKey } from "@/lib/i18n";

/**
 * THE loader. One design for the whole site and the admin panel: a notice being scanned
 * (navy page, saffron scan line). Where it appears changes, what it looks like never does:
 *
 *  - "inline"  beside/inside a button or control
 *  - "section" inside the content area that is loading
 *  - "overlay" centred over the page, only for work that genuinely blocks the page
 *
 * Fades in after a short delay (see globals.css) so quick operations do not flash it.
 */
export type LoaderPlacement = "inline" | "section" | "overlay";

function Mark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <path d="M6 2.5h8l5 5V21.5H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2.5v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12.5h7M9 15.5h7M9 18.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <rect className="gjf-loader__scan" x="4.5" y="8" width="15" height="2.2" rx="1.1" fill="#fd651e" />
    </svg>
  );
}

export function Loader({ label, placement = "section", hideLabel = false, className = "" }: { label: string; placement?: LoaderPlacement; hideLabel?: boolean; className?: string }) {
  const text = <span className={hideLabel ? "sr-only" : undefined}>{label}</span>;
  if (placement === "inline") {
    return (
      <span role="status" aria-live="polite" className={`gjf-loader inline-flex items-center gap-2 align-middle ${className}`}>
        <Mark className="h-[1.15em] w-[1.15em]" />
        {text}
      </span>
    );
  }
  if (placement === "overlay") {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={`gjf-loader fixed inset-0 z-[60] flex items-center justify-center bg-white/70 px-4 ${className}`}>
        <div className="card flex flex-col items-center gap-3 px-8 py-6 text-sm font-semibold text-navy-950">
          <Mark className="h-12 w-12 text-navy-950" />
          {text}
        </div>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`gjf-loader flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-10 text-sm font-medium text-muted ${className}`}>
      <Mark className="h-10 w-10 text-navy-950" />
      {text}
    </div>
  );
}

/** Loading text per section of the site, chosen from the page address so a single loading.tsx serves every route. */
const ROUTE_LABELS: [prefix: string, key: MessageKey][] = [
  ["/jobs/", "loading.notice"],
  ["/updates/", "loading.notice"],
  ["/jobs", "loading.jobs"],
  ["/admit-cards", "loading.admit"],
  ["/results", "loading.results"],
  ["/answer-keys", "loading.keys"],
  ["/admissions", "loading.admissions"],
  ["/updates", "loading.updates"],
  ["/states", "loading.states"],
  ["/sectors", "loading.sectors"],
  ["/exams", "loading.exams"],
  ["/organizations", "loading.jobs"],
  ["/qualifications", "loading.jobs"],
];

/** The route-level loader: the one component behind the site's single loading.tsx. Same design, text depends on the page. */
export function RouteLoader() {
  const t = useT();
  const path = usePathname();
  const key = ROUTE_LABELS.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"))?.[1] ?? "loading.default";
  return (
    <div className="container-page py-6">
      <Loader placement="section" label={t(key)} />
    </div>
  );
}

/** Place inside a <Link>: shows the shared loader beside the link text while its page is loading. */
export function LinkPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader placement="inline" label={label} hideLabel /> : null;
}
