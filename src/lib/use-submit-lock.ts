"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Frontend duplicate-submit guard. `pending` is the form's pending state (useFormStatus or
 * useActionState). The first submit takes the lock immediately — before React has re-rendered
 * with `pending = true` — so a fast double click or a second Enter cannot start a second request.
 * The lock is released when the request finishes, or after a short grace period if it never
 * started (e.g. the action returned at once), so a failed submit can never leave the form stuck.
 */
export function useSubmitLock(pending: boolean) {
  const locked = useRef(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (pending) {
      started.current = true;
      clearTimeout(timer.current);
    } else if (started.current) {
      started.current = false;
      locked.current = false;
    }
  }, [pending]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return useMemo(
    () => ({
      /** Returns false when a submit is already in flight (the caller must drop this one). */
      tryLock(): boolean {
        if (locked.current) return false;
        locked.current = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (!started.current) locked.current = false;
        }, 1500);
        return true;
      },
    }),
    [],
  );
}
