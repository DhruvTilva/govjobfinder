import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientIp, rateLimit } from "@/lib/auth";
import { CHALLENGE_COOKIE, cookieOptions, createChallenge, sameOriginOnly, telegramEnabled } from "@/lib/user-auth";

export const runtime = "nodejs";

/** Creates a login challenge, binds it to this browser by cookie, and returns the bot link to open. */
export async function POST(req: Request) {
  if (!telegramEnabled()) return NextResponse.json({ error: "Telegram login is not available." }, { status: 404 });
  if (!sameOriginOnly(req)) return NextResponse.json({ error: "Request refused." }, { status: 403 });
  if (!(await rateLimit(`tg:start:${await clientIp()}`, 10, 900))) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const { nonce, link } = await createChallenge();
  (await cookies()).set(CHALLENGE_COOKIE, nonce, cookieOptions(600));
  return NextResponse.json({ link });
}
