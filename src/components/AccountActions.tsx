"use client";

import { useRef, useState } from "react";
import { useT } from "./LangProvider";
import { SAVED_MERGED_PREFIX } from "./SavedSync";
import { PendingButton } from "./SubmitButton";

/** Removes this visitor's data from the browser so the next person on a shared computer starts clean. */
function clearLocal() {
  try {
    localStorage.removeItem("gjf:saved");
    for (const k of Object.keys(localStorage)) if (k.startsWith(SAVED_MERGED_PREFIX)) localStorage.removeItem(k);
  } catch {}
}

export function AccountActions() {
  const t = useT();
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);
  const inflight = useRef(false);

  const call = async (url: string, which: "logout" | "delete") => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(which);
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        clearLocal();
        window.location.assign("/");
        return; // stay busy while the browser navigates away
      }
    } catch {
      /* network error: fall through and re-enable the buttons */
    }
    inflight.current = false;
    setBusy(null);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <PendingButton type="button" pending={busy === "logout"} disabled={busy !== null} onClick={() => call("/api/auth/logout", "logout")} label={t("auth.logout")} pendingLabel={t("loading.loggingOut")} className="btn-primary" />
      <PendingButton
        type="button"
        pending={busy === "delete"}
        disabled={busy !== null}
        onClick={() => {
          if (window.confirm(t("account.deleteConfirm"))) call("/api/auth/delete", "delete");
        }}
        label={t("account.delete")}
        pendingLabel={t("loading.deleting")}
        className="btn-secondary text-danger"
      />
    </div>
  );
}
