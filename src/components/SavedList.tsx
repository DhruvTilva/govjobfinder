"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readSaved, writeSaved, type SavedItem } from "./SaveButton";
import { noticeHref } from "@/lib/status";
import { formatDateL } from "@/lib/i18n";
import { useLang, useT } from "./LangProvider";
import { Loader } from "./Loader";
import type { NoticeKind } from "@/db/schema";

export function SavedList() {
  const t = useT();
  const lang = useLang();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  useEffect(() => {
    const sync = () => setItems(readSaved());
    sync();
    window.addEventListener("gjf:saved", sync);
    return () => window.removeEventListener("gjf:saved", sync);
  }, []);

  if (items === null) return <Loader placement="section" label={t("saved.loading")} />;
  if (!items.length)
    return (
      <div className="card p-8 text-center text-muted">
        {t("saved.empty")}{" "}
        <Link href="/jobs" className="text-navy-700 underline">
          {t("saved.browse")}
        </Link>
      </div>
    );

  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const sorted = [...items].sort((a, b) => (a.applyEnd ?? "9999").localeCompare(b.applyEnd ?? "9999"));
  return (
    <ul className="card divide-y divide-line">
      {sorted.map((s) => {
        const closed = s.applyEnd && s.applyEnd < today;
        return (
          <li key={s.slug} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link href={noticeHref({ kind: s.kind as NoticeKind, slug: s.slug })} className="font-semibold text-ink hover:underline">
                {s.title}
              </Link>
              <p className="text-sm text-muted">
                {s.org}
                {s.applyEnd && (
                  <>
                    {" · "}
                    <span className={closed ? "text-muted line-through" : "font-semibold text-ink"}>{t("common.lastDate")} {formatDateL(s.applyEnd, lang)}</span>
                  </>
                )}
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => writeSaved(items.filter((i) => i.slug !== s.slug))}>
              {t("saved.remove")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
