import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { loginChallenges, userSessions, users } from "@/db/schema";
import { sha256 } from "./text";
import { siteUrl } from "./site";

/**
 * Optional visitor login. Two providers, each enabled only when its environment variables are set:
 *  - Google (OAuth 2.0 authorization-code flow with PKCE)
 *  - Telegram (the site issues a nonce, the bot replies with a one-time code the visitor types in)
 * With neither configured the site behaves exactly as before and shows no login UI.
 */

const COOKIE = "gjf_user";
export const CHALLENGE_COOKIE = "gjf_tg";
export const OAUTH_COOKIE = "gjf_oauth";
const SESSION_DAYS = 30;
const CHALLENGE_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

export type SiteUser = { id: number; name: string; email: string | null; googleLinked: boolean; telegramUsername: string | null; telegramLinked: boolean };

const env = (k: string) => process.env[k]?.trim() ?? "";

export const googleEnabled = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
export const telegramEnabled = () => !!(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_BOT_USERNAME") && env("TELEGRAM_WEBHOOK_SECRET"));
export const authEnabled = () => googleEnabled() || telegramEnabled();

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Lax (not Strict): the Google redirect back to /api/auth/google/callback is a cross-site navigation.
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

/** Starts a session for the user and sets the cookie. */
export async function startSession(userId: number) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db.insert(userSessions).values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  (await cookies()).set(COOKIE, token, cookieOptions(SESSION_DAYS * 86_400));
  // Opportunistic cleanup of expired sessions and challenges.
  if (Math.random() < 0.05) {
    const now = new Date();
    await db.delete(userSessions).where(lt(userSessions.expiresAt, now));
    await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, now));
  }
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(userSessions).where(eq(userSessions.id, sha256(token)));
  }
  jar.delete(COOKIE);
}

/** The logged-in visitor, or null. Always null when login is not configured. */
export async function currentUser(): Promise<SiteUser | null> {
  if (!authEnabled()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, googleSub: users.googleSub, telegramId: users.telegramId, telegramUsername: users.telegramUsername })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.id, sha256(token)), gt(userSessions.expiresAt, new Date())));
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, googleLinked: !!row.googleSub, telegramLinked: !!row.telegramId, telegramUsername: row.telegramUsername };
}

/** Rejects cross-site requests to cookie-authenticated endpoints. */
export function sameOriginOnly(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(v: string | null | undefined): string {
  return v && /^\/(?![/\\])[\w\-./?=&%]*$/.test(v) ? v : "/saved";
}

// --- Users -----------------------------------------------------------------

export async function upsertGoogleUser(p: { sub: string; email: string | null; name: string }): Promise<number> {
  const db = await getDb();
  const [bySub] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, p.sub));
  if (bySub) {
    await db.update(users).set({ name: p.name, ...(p.email ? { email: p.email } : {}) }).where(eq(users.id, bySub.id));
    return bySub.id;
  }
  // Two simultaneous first logins must end up as one account: the unique index decides, the loser reads the winner's row.
  const [created] = await db.insert(users).values({ name: p.name, email: p.email, googleSub: p.sub }).onConflictDoNothing({ target: users.googleSub }).returning({ id: users.id });
  if (created) return created.id;
  const [winner] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, p.sub));
  return winner.id;
}

export async function upsertTelegramUser(p: { id: string; name: string; username: string | null }): Promise<number> {
  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.telegramId, p.id));
  if (existing) {
    await db.update(users).set({ telegramUsername: p.username }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(users).values({ name: p.name, telegramId: p.id, telegramUsername: p.username }).onConflictDoNothing({ target: users.telegramId }).returning({ id: users.id });
  if (created) return created.id;
  const [winner] = await db.select({ id: users.id }).from(users).where(eq(users.telegramId, p.id));
  return winner.id;
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  // Sessions and saved jobs are removed by ON DELETE CASCADE.
  await db.delete(users).where(eq(users.id, userId));
  (await cookies()).delete(COOKIE);
}

// --- Telegram one-time codes -------------------------------------------------

const codeHash = (challengeId: string, code: string) => createHash("sha256").update(`${challengeId}:${code}`).digest("hex");

/** Creates a challenge. The returned nonce goes into the t.me link and the browser cookie. */
export async function createChallenge(): Promise<{ nonce: string; link: string }> {
  const db = await getDb();
  const nonce = randomBytes(16).toString("base64url");
  await db.insert(loginChallenges).values({ id: sha256(nonce), expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) });
  return { nonce, link: `https://t.me/${env("TELEGRAM_BOT_USERNAME").replace(/^@/, "")}?start=${nonce}` };
}

/** Called by the bot webhook: attaches a fresh code and the Telegram identity to the challenge. Returns the code to send. */
export async function issueCode(nonce: string, tg: { id: string; name: string; username: string | null }): Promise<string | null> {
  if (!/^[\w-]{16,40}$/.test(nonce)) return null;
  const db = await getDb();
  const id = sha256(nonce);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const updated = await db
    .update(loginChallenges)
    .set({ codeHash: codeHash(id, code), telegramId: tg.id, telegramName: tg.name, telegramUsername: tg.username, attempts: 0 })
    .where(and(eq(loginChallenges.id, id), gt(loginChallenges.expiresAt, new Date())))
    .returning({ id: loginChallenges.id });
  return updated.length ? code : null;
}

export type VerifyResult = { ok: true; userId: number } | { ok: false; error: string };

export async function verifyCode(nonce: string, code: string): Promise<VerifyResult> {
  const db = await getDb();
  const id = sha256(nonce);
  const [ch] = await db.select().from(loginChallenges).where(eq(loginChallenges.id, id));
  if (!ch || ch.expiresAt < new Date()) return { ok: false, error: "This login request has expired. Please start again." };
  if (!ch.codeHash || !ch.telegramId) return { ok: false, error: "Open Telegram, press Start in the bot, then enter the code it sends you." };
  if (ch.attempts >= MAX_CODE_ATTEMPTS) {
    await db.delete(loginChallenges).where(eq(loginChallenges.id, id));
    return { ok: false, error: "Too many wrong codes. Please start again." };
  }
  const expected = Buffer.from(ch.codeHash);
  const given = Buffer.from(codeHash(id, code));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.update(loginChallenges).set({ attempts: ch.attempts + 1 }).where(eq(loginChallenges.id, id));
    return { ok: false, error: "That code is not correct." };
  }
  // Consume the challenge atomically: of two simultaneous correct submissions only one gets a row back.
  const consumed = await db.delete(loginChallenges).where(eq(loginChallenges.id, id)).returning({ id: loginChallenges.id });
  if (!consumed.length) return { ok: false, error: "This login request was already used. Please start again." };
  const userId = await upsertTelegramUser({ id: ch.telegramId, name: ch.telegramName || ch.telegramUsername || "Telegram user", username: ch.telegramUsername });
  return { ok: true, userId };
}

export async function sendTelegramMessage(chatId: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error("Telegram sendMessage failed", res.status);
}

export function webhookSecretMatches(header: string | null): boolean {
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Google --------------------------------------------------------------------

export const googleRedirectUri = () => siteUrl("/api/auth/google/callback");

export function googleAuthUrl(state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Exchanges the authorization code and returns the verified Google identity. */
export async function googleExchange(code: string, verifier: string): Promise<{ sub: string; email: string | null; name: string } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  // The ID token came straight from Google's token endpoint over TLS, so its signature need not be
  // re-checked (OpenID Connect Core §3.1.3.7); the claims are still validated.
  try {
    const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8")) as {
      iss?: string;
      aud?: string;
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    const okIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (!okIssuer || claims.aud !== env("GOOGLE_CLIENT_ID") || !claims.exp || claims.exp * 1000 < Date.now() || !claims.sub) return null;
    const email = claims.email && claims.email_verified ? claims.email.toLowerCase() : null;
    return { sub: claims.sub, email, name: (claims.name || email || "Google user").slice(0, 120) };
  } catch {
    return null;
  }
}
