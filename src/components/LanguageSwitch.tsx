"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE } from "@/lib/i18n";
import { useLang, useT } from "./LangProvider";
import { Loader } from "./Loader";

/** Toggles the interface between English and Hindi (remembered for a year). */
export function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = lang === "hi" ? "en" : "hi";
  const toggle = () => {
    if (pending) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next === "hi" ? "hi-IN" : "en-IN";
    start(() => router.refresh());
  };
  return (
    <>
      {pending && <Loader placement="overlay" label={t("loading.language")} />}
      <button
      type="button"
      onClick={toggle}
      disabled={pending}
      lang={next === "hi" ? "hi" : "en"}
      aria-label={t("header.langLabel")}
      title={t("header.langLabel")}
      className="rounded bg-white/15 px-2 py-0.5 font-semibold text-white hover:bg-white/25 disabled:opacity-60"
    >
      {t("header.langButton")}
      </button>
    </>
  );
}
