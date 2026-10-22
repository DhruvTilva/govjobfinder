import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.TELEGRAM_BOT_TOKEN = "123:abc";
process.env.TELEGRAM_BOT_USERNAME = "@GovJobTestBot";
process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret_123";

// next/headers needs a request scope; a plain cookie jar stands in for it.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));

const { getDb, closeDb } = await import("@/db/client");
const { runMigrations } = await import("@/db/migrate");
const { users, userSessions, savedJobs, loginChallenges } = await import("@/db/schema");
const auth = await import("@/lib/user-auth");

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => {
  await runMigrations();
  db = await getDb();
});
afterAll(() => closeDb());

const tg = { id: "555", name: "Asha Verma", username: "asha_v" };
const nonceOf = (link: string) => new URL(link).searchParams.get("start")!;

describe("configuration", () => {
  it("enables providers only when their variables are set", () => {
    expect(auth.googleEnabled() && auth.telegramEnabled() && auth.authEnabled()).toBe(true);
  });
  it("only allows same-site relative redirect targets", () => {
    expect(auth.safeNext("/jobs?status=closing&sort=closing")).toBe("/jobs?status=closing&sort=closing");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) expect(auth.safeNext(bad as string)).toBe("/saved");
  });
  it("rejects cross-site requests", () => {
    const req = (h: Record<string, string>) => new Request("http://site.test/api", { method: "POST", headers: h });
    expect(auth.sameOriginOnly(req({ origin: "http://site.test", host: "site.test" }))).toBe(true);
    expect(auth.sameOriginOnly(req({ origin: "http://evil.test", host: "site.test" }))).toBe(false);
    expect(auth.sameOriginOnly(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("checks the webhook secret", () => {
    expect(auth.webhookSecretMatches("hook-secret_123")).toBe(true);
    expect(auth.webhookSecretMatches("wrong-secret_123")).toBe(false);
    expect(auth.webhookSecretMatches(null)).toBe(false);
  });
});

describe("telegram one-time code", () => {
  it("builds a bot deep link and stores only a hash of the nonce", async () => {
    const { nonce, link } = await auth.createChallenge();
    expect(link).toBe(`https://t.me/GovJobTestBot?start=${nonce}`);
    const rows = await db.select().from(loginChallenges);
    expect(rows.some((r) => r.id === nonce)).toBe(false);
  });

  it("logs in with the code the bot issued, once", async () => {
    const { link } = await auth.createChallenge();
    const nonce = nonceOf(link);
    // Nothing to verify until the visitor has pressed Start in the bot.
    expect((await auth.verifyCode(nonce, "123456")).ok).toBe(false);
    const code = await auth.issueCode(nonce, tg);
    expect(code).toMatch(/^\d{6}$/);
    const ok = await auth.verifyCode(nonce, code!);
    expect(ok.ok).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.telegramId, "555"));
    expect(u).toMatchObject({ name: "Asha Verma", telegramUsername: "asha_v" });
    // The challenge is consumed: the same code cannot be used again.
    expect((await auth.verifyCode(nonce, code!)).ok).toBe(false);
  });

  it("reuses the same account on the next login", async () => {
    const nonce = nonceOf((await auth.createChallenge()).link);
    const code = await auth.issueCode(nonce, tg);
    const res = await auth.verifyCode(nonce, code!);
    expect(res.ok).toBe(true);
    expect((await db.select().from(users).where(eq(users.telegramId, "555"))).length).toBe(1);
  });

  it("locks the challenge after too many wrong codes, even for the right code", async () => {
    const nonce = nonceOf((await auth.createChallenge()).link);
    const code = (await auth.issueCode(nonce, tg))!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < auth.MAX_CODE_ATTEMPTS; i++) expect((await auth.verifyCode(nonce, wrong)).ok).toBe(false);
    const res = await auth.verifyCode(nonce, code);
    expect(res.ok).toBe(false);
  });

  it("refuses expired or unknown challenges", async () => {
    const nonce = nonceOf((await auth.createChallenge()).link);
    await db.update(loginChallenges).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await auth.issueCode(nonce, tg)).toBeNull();
    expect((await auth.verifyCode(nonce, "123456")).ok).toBe(false);
    expect(await auth.issueCode("not-a-real-nonce-123456", tg)).toBeNull();
    expect(await auth.issueCode("short", tg)).toBeNull();
  });
});

describe("accounts, sessions and saved jobs", () => {
  it("creates one account per Google identity and updates it", async () => {
    const a = await auth.upsertGoogleUser({ sub: "g-1", email: "a@example.com", name: "A" });
    const b = await auth.upsertGoogleUser({ sub: "g-1", email: "a@example.com", name: "A Renamed" });
    expect(b).toBe(a);
    const [u] = await db.select().from(users).where(eq(users.id, a));
    expect(u.name).toBe("A Renamed");
  });

  it("starts a session that currentUser resolves, and ends it", async () => {
    const id = await auth.upsertGoogleUser({ sub: "g-2", email: "b@example.com", name: "Bee Cee" });
    await auth.startSession(id);
    const user = await auth.currentUser();
    expect(user).toMatchObject({ id, name: "Bee Cee", googleLinked: true, telegramLinked: false });
    expect((await db.select().from(userSessions).where(eq(userSessions.userId, id))).length).toBe(1);
    await auth.endSession();
    expect(await auth.currentUser()).toBeNull();
    expect((await db.select().from(userSessions).where(eq(userSessions.userId, id))).length).toBe(0);
  });

  it("does not accept an expired session", async () => {
    const id = await auth.upsertGoogleUser({ sub: "g-3", email: null, name: "Cee" });
    await auth.startSession(id);
    await db.update(userSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(userSessions.userId, id));
    expect(await auth.currentUser()).toBeNull();
  });

  it("deleting an account removes its sessions and saved jobs", async () => {
    const id = await auth.upsertGoogleUser({ sub: "g-4", email: "d@example.com", name: "Dee" });
    await auth.startSession(id);
    await db.insert(savedJobs).values({ userId: id, slug: "some-job", kind: "recruitment", title: "Some Job", applyEnd: "2030-01-01", org: "Org" });
    await auth.deleteUser(id);
    expect((await db.select().from(users).where(eq(users.id, id))).length).toBe(0);
    expect((await db.select().from(savedJobs).where(eq(savedJobs.userId, id))).length).toBe(0);
    expect((await db.select().from(userSessions).where(eq(userSessions.userId, id))).length).toBe(0);
    expect(await auth.currentUser()).toBeNull();
  });
});
