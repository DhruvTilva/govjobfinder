"use client";

import { useT } from "@/components/LangProvider";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl">{t("page.error.title")}</h1>
      <p className="mt-2 text-muted">{t("page.error.text")}</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        {t("page.error.retry")}
      </button>
    </div>
  );
}
