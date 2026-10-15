import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db/client";
import { adminSessions, adminUsers, auditLog, rateLimits } from "@/db/schema";
import { sha256 } from "./text";

const COOKIE = "gjf_admin";
const SESSION_HOURS = 12;
let dummyHash: Promise<string> | undefined;

export type AdminUser = { id: number; email: string; name: string; role: "admin" | "editor" };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/**
 * Fixed-window rate limiter stored in the database (works across serverless
 * instances). Returns false when the limit for `key` has been reached.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.05) await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 86_400_000)));
  return row.count <= limit;
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientIp();
  const normalized = email.trim().toLowerCase();
  if (!(await rateLimit(`login:ip:${ip}`, 20, 900)) || !(await rateLimit(`login:email:${normalized}`, 8, 900))) {
    return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  }
  const db = await getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized));
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails.
  dummyHash ??= bcrypt.hash("not-a-real-password", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok || !user.active) {
    await audit(null, "login_failed", "admin_user", null, { email: normalized });
    return { ok: false, error: "Incorrect email or password." };
  }
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await db.insert(adminSessions).values({
    id: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
    ip,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  await audit(user.id, "login", "admin_user", String(user.id));
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(adminSessions).where(eq(adminSessions.id, sha256(token)));
  }
  jar.delete(COOKIE);
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(and(eq(adminSessions.id, sha256(token)), gt(adminSessions.expiresAt, new Date()), eq(adminUsers.active, true)));
  return row ?? null;
}

/** Use in every admin page and server action. Redirects to login when not signed in. */
export async function requireAdmin(role: "admin" | "editor" = "editor"): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  if (role === "admin" && user.role !== "admin") throw new Error("This action requires the admin role.");
  return user;
}

export async function audit(userId: number | null, action: string, entity: string, entityId: string | null, details?: unknown) {
  const db = await getDb();
  await db.insert(auditLog).values({ userId, action, entity, entityId, details: details ?? null, ip: await clientIp().catch(() => null) });
}
