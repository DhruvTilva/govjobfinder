import "server-only";
import { randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { idempotencyKeys } from "@/db/schema";
import { IDEM_FIELD } from "./idem-field";

/**
 * Backend duplicate-submit protection. Every creating form carries a one-time token (hidden
 * field `_idem`, see <IdemToken />). The server claims `scope:token` in the database before doing
 * the work; a second request with the same token — double click, a retry, two tabs, a replayed
 * request — finds the key taken and is dropped. The database primary key makes the claim atomic,
 * so concurrent requests cannot both win. If the work fails the claim is released, so the user
 * can fix the problem and submit again with the same form.
 */
const KEEP_MS = 24 * 3600_000;

export const newIdemToken = () => randomUUID();

/** Redirects are thrown by Next.js; they mean the action succeeded. */
const isRedirect = (e: unknown) => typeof (e as { digest?: unknown })?.digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");

export type Claim = { duplicate: false; release: () => Promise<void> } | { duplicate: true };

/** Claims the submission. Forms without a token (no JavaScript) are never treated as duplicates. */
export async function claimSubmission(fd: FormData | null | undefined, scope: string): Promise<Claim> {
  const token = String(fd?.get(IDEM_FIELD) ?? "").slice(0, 64);
  if (!token) return { duplicate: false, release: async () => {} };
  const key = `${scope}:${token}`;
  const db = await getDb();
  const inserted = await db.insert(idempotencyKeys).values({ key }).onConflictDoNothing().returning({ key: idempotencyKeys.key });
  if (!inserted.length) return { duplicate: true };
  if (Math.random() < 0.02) await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(Date.now() - KEEP_MS)));
  return {
    duplicate: false,
    release: async () => {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    },
  };
}

/**
 * Runs `work` once per token. Returns `onDuplicate()` when the token was already used.
 * The claim is released when `work` throws (other than a redirect) or returns a result that
 * `failed()` reports as an error, so validation problems never burn the token.
 */
export async function once<T>(fd: FormData | null | undefined, scope: string, work: () => Promise<T>, onDuplicate: () => T | never, failed: (r: T) => boolean = () => false): Promise<T> {
  const claim = await claimSubmission(fd, scope);
  if (claim.duplicate) return onDuplicate();
  try {
    const result = await work();
    if (failed(result)) await claim.release();
    return result;
  } catch (e) {
    if (!isRedirect(e)) await claim.release().catch(() => {});
    throw e;
  }
}
