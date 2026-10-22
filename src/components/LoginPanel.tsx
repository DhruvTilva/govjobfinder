"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useT } from "./LangProvider";
import { Loader } from "./Loader";
import { PendingButton } from "./SubmitButton";

/** Login options. Each provider is shown only when it is configured on the server. */
export function LoginPanel({ google, telegram, next, error }: { google: boolean; telegram: boolean; next: string; error?: string }) {
  const t = useT();
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"start" | "verify" | "google" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Synchronous guard: state updates are asynchronous, so a fast double click could otherwise start two requests.
  const inflight = useRef(false);

  const startTelegram = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy("start");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/telegram/start", { method: "POST" });
      const data = (await res.json()) as { link?: string; error?: string };
      if (!res.ok || !data.link) {
        setMsg(data.error ?? t("auth.errConfig"));
        return;
      }
      setTgLink(data.link);
      window.open(data.link, "_blank", "noopener,noreferrer");
    } catch {
      setMsg(t("auth.errConfig"));
    } finally {
      inflight.current = false;
      setBusy(null);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inflight.current) return;
    inflight.current = true;
    setBusy("verify");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/telegram/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, next }) });
      const data = (await res.json()) as { next?: string; error?: string };
      if (!res.ok) {
        setMsg(data.error ?? t("auth.errConfig"));
      } else {
        // Stay busy while the browser navigates away; the lock is only released on failure.
        window.location.assign(data.next ?? "/saved");
        return;
      }
    } catch {
      setMsg(t("auth.errConfig"));
    }
    inflight.current = false;
    setBusy(null);
  };

  const queryError = error === "rate" ? t("auth.errRate") : error === "config" ? t("auth.errConfig") : error ? t("auth.errGoogle") : null;
  const shown = msg ?? queryError;

  return (
    <div className="space-y-3">
      {shown && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {shown}
        </p>
      )}
      {google && (
        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          aria-disabled={busy === "google" || undefined}
          onClick={(e) => {
            if (inflight.current) return e.preventDefault();
            inflight.current = true;
            setBusy("google");
          }}
          className={`btn-secondary w-full justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy === "google" ? <Loader placement="inline" label={t("loading.signingIn")} /> : t("auth.google")}
        </a>
      )}
      {google && telegram && (
        <p aria-hidden className="text-center text-xs text-muted">
          {t("auth.or")}
        </p>
      )}
      {telegram &&
        (tgLink ? (
          <form onSubmit={verify} className="space-y-2">
            <p className="text-sm text-muted">{t("auth.tgHint")}</p>
            <a href={tgLink} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center">
              {t("auth.tgOpen")}
            </a>
            <label htmlFor="tg-code" className="label">
              {t("auth.tgCode")}
            </label>
            <input
              id="tg-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="input tracking-widest"
            />
            <PendingButton pending={busy === "verify"} disabled={busy !== null || code.length !== 6} label={t("auth.tgVerify")} pendingLabel={t("loading.verifying")} className="btn-primary w-full" />
          </form>
        ) : (
          <PendingButton type="button" onClick={startTelegram} pending={busy === "start"} disabled={busy !== null} label={t("auth.telegram")} pendingLabel={t("auth.tgWorking")} className="btn-secondary w-full justify-center" />
        ))}
      <p className="pt-1 text-xs text-muted">
        {t("auth.consent")}{" "}
        <Link href="/terms-of-use" className="underline">
          {t("footer.terms")}
        </Link>
        {" · "}
        <Link href="/privacy-policy" className="underline">
          {t("footer.privacy")}
        </Link>
      </p>
    </div>
  );
}
