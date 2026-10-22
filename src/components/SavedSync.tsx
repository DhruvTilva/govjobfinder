"use client";

import { useEffect } from "react";
import { readSaved, writeSaved, type SavedItem } from "./SaveButton";

/** Browser keys that hold per-visitor data; cleared on logout so a shared computer keeps nothing. */
export const SAVED_MERGED_PREFIX = "gjf:saved-merged:";

async function push(items: SavedItem[]) {
  try {
    await fetch("/api/saved", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
  } catch {
    /* offline — the next change retries with the full list */
  }
}

/**
 * Keeps saved jobs in step with the visitor's account. Renders nothing; mounted once in the site
 * layout, and only does anything when someone is logged in.
 *  - First login on this browser: jobs already saved here are merged into the account.
 *  - After that the account's list is the source of truth and every local change is pushed to it.
 * The browser's own list remains the working copy, so the save buttons behave the same as before.
 */
export function SavedSync({ userId }: { userId: number | null }) {
  useEffect(() => {
    if (!userId) return;
    let ready = false;
    let applying = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flag = `${SAVED_MERGED_PREFIX}${userId}`;

    (async () => {
      try {
        const res = await fetch("/api/saved");
        if (!res.ok) return;
        const server = ((await res.json()) as { items: SavedItem[] }).items;
        let list = server;
        let firstTime = false;
        try {
          firstTime = localStorage.getItem(flag) !== "1";
        } catch {}
        if (firstTime) {
          const onServer = new Set(server.map((i) => i.slug));
          list = [...readSaved().filter((l) => !onServer.has(l.slug)), ...server].slice(0, 200);
        }
        applying = true;
        writeSaved(list);
        applying = false;
        if (firstTime) {
          await push(list);
          try {
            localStorage.setItem(flag, "1");
          } catch {}
        }
        ready = true;
      } catch {
        /* the browser copy keeps working without the account list */
      }
    })();

    const onChange = () => {
      if (applying || !ready) return;
      clearTimeout(timer);
      timer = setTimeout(() => push(readSaved()), 500);
    };
    window.addEventListener("gjf:saved", onChange);
    return () => {
      window.removeEventListener("gjf:saved", onChange);
      clearTimeout(timer);
    };
  }, [userId]);
  return null;
}
