import Link from "next/link";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";
import { getI18n } from "@/lib/i18n-server";

type FooterLink = [href: string, label: string];

export async function SiteFooter() {
  const { t } = await getI18n();
  const cols: { title: string; links: FooterLink[] }[] = [
    {
      title: t("footer.quickTitle"),
      links: [
        ["/jobs", t("nav.jobs")],
        ["/jobs?status=closing&sort=closing", t("nav.closing")],
        ["/admit-cards", t("nav.admit")],
        ["/results", t("nav.results")],
        ["/answer-keys", t("nav.keys")],
      ],
    },
    {
      title: t("footer.exploreTitle"),
      links: [
        ["/states", t("nav.states")],
        ["/sectors", t("nav.sectors")],
        ["/exams", t("nav.exams")],
      ],
    },
    {
      title: t("footer.infoTitle"),
      links: [
        ["/about", t("footer.aboutUs")],
        ["/faq", t("footer.faq")],
        ["/user-guide", t("footer.guide")],
        ["/privacy-policy", t("footer.privacy")],
        ["/terms-of-use", t("footer.terms")],
        ["/disclaimer", t("footer.disclaimer")],
      ],
    },
  ];

  return (
    <footer className="mt-12 border-t-2 border-brand bg-footer pb-6 pt-8 text-xs text-slate-300">
      <div className="container-page space-y-8">
        <div className="grid grid-cols-2 gap-6 border-b border-slate-800 pb-6 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-white">
              <span className="text-sm font-bold">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 leading-relaxed text-slate-400">{t("footer.about")}</p>
          </div>
          {cols.map((c) => (
            <FooterCol key={c.title} title={c.title} links={c.links} />
          ))}
          <div className="col-span-2 md:col-span-1">
            <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white">{t("footer.helpTitle")}</h2>
            <p className="leading-relaxed text-slate-400">{t("footer.supportText")}</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 inline-block break-all font-medium text-slate-200 underline underline-offset-2 transition-colors hover:text-white">
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          <p className="font-medium text-slate-300">
            © {new Date().getFullYear()} {SITE_NAME}. {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white">{title}</h2>
      <ul className="space-y-1.5 text-slate-400">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

