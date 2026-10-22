"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookmarkIcon } from "./icons";
import { readSaved } from "./SaveButton";
import { useT } from "./LangProvider";
import { useAuth } from "./AuthProvider";

/** Header link to saved jobs with a count badge (saved items live in this browser). */
export function SavedLink() {
  const t = useT();
  const { loginRequired } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(loginRequired ? 0 : readSaved().length);
    sync();
    window.addEventListener("gjf:saved", sync);
    // Keeps several open tabs in step.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gjf:saved", sync);
      window.removeEventListener("storage", sync);
    };
  }, [loginRequired]);
  const label = count ? `${t("header.saved")} (${count})` : t("header.saved");
  return (
    <Link href={loginRequired ? "/login?next=/saved" : "/saved"} className="btn-secondary relative shrink-0 px-3 py-1.5 sm:px-4 sm:py-2.5" aria-label={label}>
      <BookmarkIcon filled={count > 0} className={`h-4 w-4 ${count ? "text-accent" : ""}`} />
      <span className="hidden md:inline">{t("header.saved")}</span>
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
