"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";

const SIZES = [
  { key: "sm", label: "A-", pct: "93.75%", name: "header.textSmaller" },
  { key: "md", label: "A", pct: "100%", name: "header.textDefault" },
  { key: "lg", label: "A+", pct: "112.5%", name: "header.textLarger" },
] as const;
const KEY = "gjf:text-size";

const bootScript = `try{var s=localStorage.getItem("${KEY}");var m={sm:"93.75%",lg:"112.5%"};if(m[s])document.documentElement.style.fontSize=m[s];}catch(e){}`;

/**
 * Inline script for <head>: applies the saved size before first paint.
 * Must stay in a Client Component: the `typeof window` check has to run in the browser too,
 * so the client renders the tag inert (avoids React 19's "script tag" dev warning).
 */
export function TextSizeBootScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: bootScript }}
    />
  );
}

export function TextSize() {
  const t = useT();
  const [size, setSize] = useState<string>("md");
  useEffect(() => {
    try {
      setSize(localStorage.getItem(KEY) ?? "md");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const apply = (key: string, pct: string) => {
    document.documentElement.style.fontSize = pct;
    setSize(key);
    try {
      localStorage.setItem(KEY, key);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div role="group" aria-label={t("header.textSize")} className="flex items-center gap-0.5">
      <span className="mr-1 hidden text-white/60 sm:inline">{t("header.textSize")}</span>
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => apply(s.key, s.pct)}
          aria-pressed={size === s.key}
          aria-label={t(s.name)}
          className={`rounded px-1.5 py-0.5 font-bold ${size === s.key ? "bg-white/15 text-white" : "text-white/75 hover:text-white"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
