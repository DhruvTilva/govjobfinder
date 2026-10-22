import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.TELEGRAM_BOT_TOKEN = "123:abc";
process.env.TELEGRAM_BOT_USERNAME = "GovJobTestBot";
process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret_123";
process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "secret";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { getDb, closeDb } = await import("@/db/client");
const { runMigrations } = await import("@/db/migrate");
const { users, uploads, idempotencyKeys } = await import("@/db/schema");
const { claimSubmission, once } = await import("@/lib/idempotency");
const { IDEM_FIELD } = await import("@/lib/idem-field");
const auth = await import("@/lib/user-auth");
const { storeBytes } = await import("@/lib/storage");

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => {
  await runMigrations();
  db = await getDb();
});
afterAll(() => closeDb());

const form = (token?: string) => {
  const fd = new FormData();
  if (token !== undefined) fd.set(IDEM_FIELD, token);
  return fd;
};

describe("submission tokens", () => {
  it("lets exactly one of several simultaneous submissions through", async () => {
    const fd = form("tok-concurrent");
    let created = 0;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        once(
          fd,
          "create",
          async () => {
            created++;
            return "created";
          },
          () => "duplicate",
        ),
      ),
    );
    expect(created).toBe(1);
    expect(results.filter((r) => r === "created")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(5);
  });

  it("scopes tokens, so one token cannot block a different action", async () => {
    expect((await claimSubmission(form("tok-scope"), "a")).duplicate).toBe(false);
    expect((await claimSubmission(form("tok-scope"), "b")).duplicate).toBe(false);
    expect((await claimSubmission(form("tok-scope"), "a")).duplicate).toBe(true);
  });

  it("does not burn the token when the work fails or returns an error, so the user can retry", async () => {
    const fd = form("tok-retry");
    await expect(
      once(fd, "create", async () => { throw new Error("database down"); }, () => "duplicate"),
    ).rejects.toThrow("database down");
    const invalid = await once<{ error?: string }>(fd, "create", async () => ({ error: "Title is required" }), () => ({}), (r) => !!r.error);
    expect(invalid.error).toBe("Title is required");
    const ok = await once<string>(fd, "create", async () => "created", () => "duplicate");
    expect(ok).toBe("created");
    expect(await once<string>(fd, "create", async () => "created again", () => "duplicate")).toBe("duplicate");
  });

  it("keeps the token used when the action succeeds by redirecting", async () => {
    const fd = form("tok-redirect");
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/bigboss/notices/1;307;" });
    await expect(once(fd, "create", async () => { throw redirect; }, () => "duplicate")).rejects.toBe(redirect);
    expect(await once<string>(fd, "create", async () => "second", () => "duplicate")).toBe("duplicate");
  });

  it("does not treat forms without a token as duplicates (no-JavaScript fallback)", async () => {
    let n = 0;
    for (let i = 0; i < 3; i++) await once(form(), "create", async () => ++n, () => 0);
    expect(n).toBe(3);
    expect((await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, "create:"))).length).toBe(0);
  });
});

describe("account creation under concurrency", () => {
  it("creates one account when the same Google identity logs in simultaneously", async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, () => auth.upsertGoogleUser({ sub: "g-race", email: "r@example.com", name: "Race" })));
    expect(new Set(ids).size).toBe(1);
    expect((await db.select().from(users).where(eq(users.googleSub, "g-race"))).length).toBe(1);
  });

  it("creates one account when the same Telegram identity logs in simultaneously", async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, () => auth.upsertTelegramUser({ id: "777", name: "Tee", username: "tee" })));
    expect(new Set(ids).size).toBe(1);
    expect((await db.select().from(users).where(eq(users.telegramId, "777"))).length).toBe(1);
  });

  it("accepts a login code only once even when submitted twice at the same time", async () => {
    const { link } = await auth.createChallenge();
    const nonce = new URL(link).searchParams.get("start")!;
    const code = (await auth.issueCode(nonce, { id: "888", name: "Dee", username: null }))!;
    const [a, b] = await Promise.all([auth.verifyCode(nonce, code), auth.verifyCode(nonce, code)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect((await db.select().from(users).where(eq(users.telegramId, "888"))).length).toBe(1);
  });
});

describe("uploads", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 same file");
  const input = { bytes, fileName: "notice.pdf", contentType: "application/pdf", userId: null };

  it("stores one copy when the same file is uploaded twice in a row", async () => {
    const [a, b] = [await storeBytes(db, input), await storeBytes(db, input)];
    expect(b.id).toBe(a.id);
    expect((await db.select().from(uploads).where(eq(uploads.sha256, "dummy-none"))).length).toBe(0);
    const all = await db.select().from(uploads);
    expect(all.filter((u) => u.fileName === "notice.pdf")).toHaveLength(1);
  });

  it("still stores a different file as a new upload", async () => {
    const other = await storeBytes(db, { ...input, bytes: new TextEncoder().encode("%PDF-1.4 other file") });
    const all = await db.select().from(uploads);
    expect(all.filter((u) => u.fileName === "notice.pdf")).toHaveLength(2);
    expect(other.id).toBeGreaterThan(0);
  });
});
