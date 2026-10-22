"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkIcon } from "./icons";
import { useT } from "./LangProvider";
import { useAuth } from "./AuthProvider";

export type SavedItem = { slug: string; kind: string; title: string; applyEnd: string | null; org: string | null };

const KEY = "gjf:saved";

export function readSaved(): SavedItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeSaved(items: SavedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
    window.dispatchEvent(new Event("gjf:saved"));
  } catch {
    /* storage unavailable (private mode) — saving is best-effort */
  }
}

/** Bookmarks a notice. When login is configured, saving needs an account and visitors who are not logged in are sent to the login page. */
export function SaveButton({ item, compact }: { item: SavedItem; compact?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { loginRequired } = useAuth();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(!loginRequired && readSaved().some((s) => s.slug === item.slug));
    sync();
    window.addEventListener("gjf:saved", sync);
    return () => window.removeEventListener("gjf:saved", sync);
  }, [item.slug, loginRequired]);

  const toggle = () => {
    if (loginRequired) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const list = readSaved();
    writeSaved(saved ? list.filter((s) => s.slug !== item.slug) : [item, ...list.filter((s) => s.slug !== item.slug)]);
  };

  const label = loginRequired ? t("auth.saveLogin") : saved ? t("common.removeSaved") : t("common.saveForLater");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={compact ? `rounded-md p-1.5 ${saved ? "text-accent" : "text-muted hover:bg-navy-50 hover:text-navy-950"}` : "btn-secondary"}
    >
      <BookmarkIcon filled={saved} className="h-4 w-4" />
      {!compact && <span>{saved ? t("common.saved") : t("common.save")}</span>}
    </button>
  );
}
