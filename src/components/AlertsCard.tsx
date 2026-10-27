"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "./LangProvider";
import { SearchIcon } from "./icons";

type Opt = { slug: string; name: string };

/**
 * Quick state / sector / qualification picker that opens the matching /jobs
 * listing. The sector list narrows to sectors with active jobs in the chosen state.
 */
export function AlertsCard({
  states,
  sectors,
  qualifications,
  stateSectors,
}: {
  states: Opt[];
  sectors: Opt[];
  qualifications: Opt[];
  stateSectors: Record<string, string[]>;
}) {
  const t = useT();
  const [state, setState] = useState("");
  const [sector, setSector] = useState("");
  const [qual, setQual] = useState("");
  const allowed = state ? new Set(stateSectors[state] ?? []) : null;
  const sectorOpts = allowed ? sectors.filter((s) => allowed.has(s.slug)) : sectors;

  const pickState = (v: string) => {
    setState(v);
    if (v && sector && !(stateSectors[v] ?? []).includes(sector)) setSector("");
  };

  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (sector) params.set("sector", sector);
  if (qual) params.set("qual", qual);
  const href = params.size ? `/jobs?${params}` : "/jobs";

  const sel = "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#fd651e]";
  return (
    <section className="relative overflow-hidden rounded-xl bg-navy-950 p-5 text-white shadow-md" aria-labelledby="alerts-h">
      <span aria-hidden className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[#fd651e]/15" />
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#fdba8c]">
        {t("alerts.eyebrow")}
      </p>
      <h2 id="alerts-h" className="mt-1 text-xl font-bold leading-tight text-white">
        {t("alerts.title")}
      </h2>
      <p className="mt-1 text-sm text-white/75">{t("alerts.text")}</p>
      <div className="mt-3 space-y-2">
        <label className="sr-only" htmlFor="al-state">
          {t("list.state")}
        </label>
        <select id="al-state" value={state} onChange={(e) => pickState(e.target.value)} className={sel}>
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
          {sectorOpts.map((s) => (
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
      <Link href={href} className="btn mt-3 w-full gap-1.5 bg-[#fd651e] py-2.5 text-white hover:bg-[#e4560f]">
        <SearchIcon className="h-4 w-4" />
        {t("alerts.search")}
      </Link>
    </section>
  );
}
