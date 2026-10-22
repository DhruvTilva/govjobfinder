"use client";

import { useEffect, useState } from "react";
import { IDEM_FIELD } from "@/lib/idem-field";

/**
 * One-time submission token for client-side forms. Created after mount (so server and client markup
 * match) and renewed with `renew()` once a submission has finished, so the same form can be used again.
 */
export function useIdemToken() {
  const [token, setToken] = useState("");
  useEffect(() => setToken(crypto.randomUUID()), []);
  return {
    field: <input type="hidden" name={IDEM_FIELD} value={token} readOnly />,
    renew: () => setToken(crypto.randomUUID()),
  };
}
