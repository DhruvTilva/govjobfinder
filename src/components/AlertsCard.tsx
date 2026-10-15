"use client";

import { useState } from "react";
import { RssIcon } from "./icons";
import { useT } from "./LangProvider";

type Opt = { slug: string; name: string };

/**
 * Builds a personal RSS feed URL for the chosen filters. No sign-up and no
 * personal data: the filters live in the URL, and any feed reader can follow it.
 */
export function AlertsCard({ states, sectors, qualifications, siteUrl }: { states: Opt[]; sectors: Opt[]; qualifications: Opt[]; siteUrl: string }) {
  const t = useT();
  const [state, setState] = useState("");
  const [sector, setSector] = useState("");
  const [qual, setQual] = useState("");
  const [copied, setCopied] = useState(false);
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (sector) params.set("sector", sector);
  if (qual) params.set("qual", qual);
  params.set("kind", "recruitment");
  const url = `${siteUrl}/feed.xml?${params}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is visible to copy manually */
    }
  };

  const sel = "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#fd651e]";
  return (
    <section className="relative overflow-hidden rounded-xl bg-navy-950 p-5 text-white shadow-md" aria-labelledby="alerts-h">
      <span aria-hidden className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[#fd651e]/15" />
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#fdba8c]">
        <RssIcon className="h-3.5 w-3.5" /> {t("alerts.eyebrow")}
      </p>
      <h2 id="alerts-h" className="mt-1 text-xl font-bold leading-tight text-white">
        {t("alerts.title")}
      </h2>
      <p className="mt-1 text-sm text-white/75">{t("alerts.text")}</p>
      <div className="mt-3 space-y-2">
        <label className="sr-only" htmlFor="al-state">
          {t("list.state")}
        </label>
        <select id="al-state" value={state} onChange={(e) => setState(e.target.value)} className={sel}>
          <option value="">{t("common.allIndia")}</option>
          <option value="central">{t("common.centralGovt")}</option>
          {states.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="al-sector">
          {t("list.sector")}
        </label>
        <select id="al-sector" value={sector} onChange={(e) => setSector(e.target.value)} className={sel}>
          <option value="">{t("home.allSectors")}</option>
          {sectors.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="al-qual">
          {t("list.qual")}
        </label>
        <select id="al-qual" value={qual} onChange={(e) => setQual(e.target.value)} className={sel}>
          <option value="">{t("home.anyQual")}</option>
          {qualifications.map((q) => (
            <option key={q.slug} value={q.slug}>
              {q.name}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-3 break-all rounded-md bg-white/10 px-2.5 py-1.5 font-mono text-[11px] text-white/85">{url}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="btn bg-[#fd651e] py-2 text-white hover:bg-[#e4560f]">
          {copied ? t("alerts.copied") : t("alerts.copy")}
        </button>
        <a href={url} target="_blank" rel="noopener" className="btn bg-white/10 py-2 text-white hover:bg-white/20">
          {t("alerts.open")}
        </a>
      </div>
    </section>
  );
}
