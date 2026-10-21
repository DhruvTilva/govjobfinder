import Link from "next/link";
import { SearchIcon } from "./icons";
import { SITE_NAME } from "@/lib/site";
import { getI18n } from "@/lib/i18n-server";
import type { MessageKey } from "@/lib/i18n";
import { TextSize } from "./TextSize";
import { LanguageSwitch } from "./LanguageSwitch";
import { SavedLink } from "./SavedLink";
import { MobileMenu } from "./MobileMenu";

const NAV: { href: string; key: MessageKey }[] = [
  { href: "/", key: "common.home" },
  { href: "/jobs", key: "nav.jobs" },
  { href: "/jobs?status=closing&sort=closing", key: "nav.closing" },
  { href: "/admit-cards", key: "nav.admit" },
  { href: "/results", key: "nav.results" },
  { href: "/answer-keys", key: "nav.keys" },
  { href: "/admissions", key: "nav.admissions" },
  { href: "/states", key: "nav.states" },
  { href: "/sectors", key: "nav.sectors" },
  { href: "/exams", key: "nav.exams" },
  { href: "/tools/eligibility", key: "nav.age" },
];

export async function SiteHeader() {
  const { t } = await getI18n();
  return (
    <header className="z-40 border-b border-line bg-white/95 backdrop-blur lg:sticky lg:top-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t("header.skip")}
      </a>
      <div className="bg-navy-950 text-xs text-white/85">
        <div className="container-page flex items-center justify-between gap-3 py-1.5">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{t("header.utility")}</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <TextSize />
            <span aria-hidden className="text-white/30">
              |
            </span>
            <LanguageSwitch />
          </div>
        </div>
      </div>
      <div className="container-page flex items-center gap-3 py-2 sm:py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${SITE_NAME} home`}>
          <span className="hidden sm:block">
            <span className="block text-lg font-bold leading-tight tracking-tight text-navy-950">{SITE_NAME}</span>
            <span className="block text-[11px] font-medium text-muted">{t("header.tagline")}</span>
          </span>
        </Link>
        <form action="/jobs" className="relative ml-auto w-full max-w-lg" role="search">
          <label htmlFor="site-search" className="sr-only">
            {t("header.searchLabel")}
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input id="site-search" name="q" type="search" placeholder={t("header.search")} className="input py-1.5 pl-9 sm:py-2.5" />
        </form>
        <SavedLink />
        <MobileMenu items={NAV.map((n) => ({ href: n.href, label: t(n.key) }))} />
      </div>
      <nav aria-label={t("nav.label")} className="hidden bg-navy-900 md:block">
        <ul className="container-page flex gap-1 overflow-x-auto whitespace-nowrap text-sm scrollbar-none">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="block px-3 py-2.5 font-medium text-white/90 hover:bg-white/10 hover:text-white">
                {t(n.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
