import { IDEM_FIELD } from "@/lib/idem-field";
import { newIdemToken } from "@/lib/idempotency";

/**
 * Put inside a server-rendered <form> that creates something. Carries a fresh one-time token so the
 * server can drop a repeated submission of the same form (see lib/idempotency.ts).
 */
export function IdemToken() {
  return <input type="hidden" name={IDEM_FIELD} value={newIdemToken()} readOnly />;
}
