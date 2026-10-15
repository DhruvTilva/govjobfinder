"use client";

import { useMemo, useState } from "react";
import { useT } from "./LangProvider";
import type { MessageKey } from "@/lib/i18n";

/** Common central-government upper-age relaxations (years). Notices can differ. */
const CATEGORY_RELAX: Record<string, { label: MessageKey; years: number }> = {
  gen: { label: "age.cat.gen", years: 0 },
  obc: { label: "age.cat.obc", years: 3 },
  scst: { label: "age.cat.scst", years: 5 },
};
const PWBD_RELAX = 10;

export function ageOn(dob: string, on: string): { years: number; months: number; days: number } | null {
  if (!dob || !on) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  if (!by || !y) return null;
  let years = y - by;
  let months = m - bm;
  let days = d - bd;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years < 0 ? null : { years, months, days };
}

export function EligibilityCalculator() {
  const t = useT();
  const [dob, setDob] = useState("");
  const [on, setOn] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const [min, setMin] = useState("18");
  const [max, setMax] = useState("");
  const [cat, setCat] = useState("gen");
  const [pwbd, setPwbd] = useState(false);

  const age = useMemo(() => ageOn(dob, on), [dob, on]);
  const relax = CATEGORY_RELAX[cat].years + (pwbd ? PWBD_RELAX : 0);
  const minN = Number(min) || 0;
  const maxN = max ? Number(max) + relax : null;
  const exact = age ? age.years + age.months / 12 + age.days / 365 : null;
  const tooYoung = exact != null && exact < minN;
  // Upper limits are normally inclusive of the whole year ("not more than 30 years" = up to 30 years, 364 days).
  const tooOld = exact != null && maxN != null && age!.years > maxN;

  return (
    <div className="card grid gap-6 p-5 md:grid-cols-2">
      <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
        <Field id="dob" label={t("age.dob")}>
          <input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} className="input" />
        </Field>
        <Field id="on" label={t("age.on")}>
          <input id="on" type="date" value={on} onChange={(e) => setOn(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="min" label={t("age.min")}>
            <input id="min" type="number" min={14} max={60} value={min} onChange={(e) => setMin(e.target.value)} className="input" />
          </Field>
          <Field id="max" label={t("age.max")}>
            <input id="max" type="number" min={16} max={70} placeholder="e.g. 30" value={max} onChange={(e) => setMax(e.target.value)} className="input" />
          </Field>
        </div>
        <Field id="cat" label={t("age.category")}>
          <select id="cat" value={cat} onChange={(e) => setCat(e.target.value)} className="input">
            {Object.entries(CATEGORY_RELAX).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v.label)} {v.years ? t("age.yrs", { n: v.years }) : ""}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pwbd} onChange={(e) => setPwbd(e.target.checked)} className="h-4 w-4" /> {t("age.pwbd", { n: PWBD_RELAX })}
        </label>
      </form>
      <div aria-live="polite" className="rounded-lg bg-navy-50 p-4">
        {!age ? (
          <p className="text-sm text-muted">{t("age.enter")}</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("age.yourAge", { date: on })}</p>
            <p className="mt-1 text-3xl font-bold text-ink">
              {age.years} <span className="text-lg">{t("age.years")}</span> {age.months} <span className="text-lg">{t("age.months")}</span> {age.days}{" "}
              <span className="text-lg">{t("age.days")}</span>
            </p>
            {max && (
              <p className={`mt-4 rounded-lg px-3 py-2 font-semibold ${tooYoung || tooOld ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}>
                {tooYoung ? t("age.young", { n: minN }) : tooOld ? t("age.old", { n: maxN! }) : t("age.ok", { a: minN, b: maxN! })}
              </p>
            )}
            <p className="mt-4 text-xs text-muted">{t("age.note")}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}
