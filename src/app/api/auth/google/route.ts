import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clientIp, rateLimit } from "@/lib/auth";
import { cookieOptions, googleAuthUrl, googleEnabled, OAUTH_COOKIE, safeNext } from "@/lib/user-auth";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

/** Starts "Continue with Google": sets a short-lived state/PKCE cookie and redirects to Google. */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(siteUrl("/login"));
  if (!(await rateLimit(`oauth:ip:${await clientIp()}`, 30, 900))) return NextResponse.redirect(siteUrl("/login?error=rate"));
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  (await cookies()).set(OAUTH_COOKIE, Buffer.from(JSON.stringify({ state, verifier, next })).toString("base64url"), cookieOptions(600));
  return NextResponse.redirect(googleAuthUrl(state, challenge));
}
