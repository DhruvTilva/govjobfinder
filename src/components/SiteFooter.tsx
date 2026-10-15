import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { getI18n } from "@/lib/i18n-server";
import { stateName } from "@/lib/i18n";

type FooterLink = [href: string, label: string];

export async function SiteFooter() {
  const { t, lang } = await getI18n();
  const st = (slug: string, en: string) => stateName(lang, slug, en);
  const cols: { title: string; links: FooterLink[] }[] = [
    {
      title: t("footer.centralTitle"),
      links: [
        ["/organizations/upsc", "UPSC"],
        ["/organizations/ssc", "SSC — CGL / CHSL / MTS"],
        ["/sectors/railways", lang === "hi" ? "रेलवे (RRB / RRC)" : "Railways (RRB / RRC)"],
        ["/organizations/ibps", "IBPS — PO / Clerk / SO"],
        ["/organizations/sbi", "SBI"],
        ["/organizations/rbi", "RBI"],
      ],
    },
    {
      title: t("footer.stateTitle"),
      links: [
        ["/states/uttar-pradesh", `${st("uttar-pradesh", "Uttar Pradesh")} — UPPSC`],
        ["/states/bihar", `${st("bihar", "Bihar")} — BPSC`],
        ["/states/madhya-pradesh", `${st("madhya-pradesh", "Madhya Pradesh")} — MPPSC`],
        ["/states/rajasthan", `${st("rajasthan", "Rajasthan")} — RPSC`],
        ["/states/maharashtra", `${st("maharashtra", "Maharashtra")} — MPSC`],
        ["/states", t("footer.allStates")],
      ],
    },
    {
      title: t("footer.defenceTitle"),
      links: [
        ["/organizations/indian-army", lang === "hi" ? "भारतीय सेना / अग्निवीर" : "Indian Army / Agniveer"],
        ["/organizations/indian-navy", lang === "hi" ? "भारतीय नौसेना" : "Indian Navy"],
        ["/organizations/indian-air-force", lang === "hi" ? "भारतीय वायु सेना" : "Indian Air Force"],
        ["/organizations/indian-coast-guard", lang === "hi" ? "भारतीय तटरक्षक" : "Indian Coast Guard"],
        ["/sectors/police-paramilitary", t("footer.capf")],
      ],
    },
    {
      title: t("footer.utilitiesTitle"),
      links: [
        ["/tools/eligibility", t("footer.age")],
        ["/qualifications", t("footer.byQual")],
        ["/saved", t("home.tool.saved")],
        ["/exams", t("footer.exams")],
      ],
    },
    {
      title: t("footer.siteTitle"),
      links: [
        ["/about", t("footer.how")],
        ["/about#faq", t("footer.faq")],
        ["/sectors", t("footer.allSectors")],
        ["/updates", t("footer.schedules")],
        ["/sitemap.xml", t("footer.sitemap")],
      ],
    },
  ];

  return (
    <footer className="mt-12 border-t-2 border-brand bg-footer pb-6 pt-8 text-xs text-slate-300">
      <div className="container-page space-y-8">
        <div className="grid grid-cols-2 gap-6 border-b border-slate-800 pb-6 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-white">
              <span className="text-sm font-bold">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 leading-relaxed text-slate-400">{t("footer.about")}</p>
          </div>
          {cols.map((c) => (
            <FooterCol key={c.title} title={c.title} links={c.links} />
          ))}
        </div>
        <div className="flex flex-col items-start justify-between gap-4 text-[11px] text-slate-400 md:flex-row md:items-center">
          <div>
            <p className="font-medium text-slate-300">
              © {new Date().getFullYear()} {SITE_NAME}. {t("footer.copyright")}
            </p>
            <p className="mt-0.5 text-slate-500">{t("footer.trademark")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link href="/about" className="hover:text-white">
              {t("footer.how")}
            </Link>
          </div>
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

