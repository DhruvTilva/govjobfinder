import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { sources } from "@/db/schema";
import { safeFetch, FetchError } from "./net";
import { hostnameOf } from "@/lib/url";

export type UrlCheck = {
  status: "ok" | "redirect" | "broken" | "blocked" | "timeout";
  httpStatus: number | null;
  finalUrl: string | null;
  error: string | null;
};

/** Checks that a URL loads. Redirects to a different host are reported as "redirect". */
export async function checkUrl(url: string): Promise<UrlCheck> {
  try {
    const r = await safeFetch(url, { timeoutMs: 30_000, maxBytes: 3 * 1024 * 1024 });
    const movedHost = hostnameOf(r.finalUrl) !== hostnameOf(url);
    return { status: movedHost ? "redirect" : "ok", httpStatus: r.status, finalUrl: r.finalUrl, error: null };
  } catch (e) {
    const fe = e instanceof FetchError ? e : new FetchError(String(e), "network");
    const status = fe.code === "timeout" ? "timeout" : fe.code === "blocked" ? "blocked" : "broken";
    return { status, httpStatus: fe.status ?? null, finalUrl: null, error: fe.message };
  }
}

export async function validateSourceUrl(db: DB, id: number, url: string) {
  const res = await checkUrl(url);
  await db
    .update(sources)
    .set({
      urlStatus: res.status,
      urlCheckedAt: new Date(),
      finalUrl: res.finalUrl,
      lastStatusCode: res.httpStatus,
      ...(res.error ? { lastError: `URL check: ${res.error}` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(sources.id, id));
  return res;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
