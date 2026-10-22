import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/auth";
import { CHALLENGE_COOKIE, safeNext, sameOriginOnly, startSession, telegramEnabled, verifyCode } from "@/lib/user-auth";

export const runtime = "nodejs";

const body = z.object({ code: z.string().regex(/^\d{6}$/), next: z.string().max(200).optional() });

export async function POST(req: Request) {
  if (!telegramEnabled()) return NextResponse.json({ error: "Telegram login is not available." }, { status: 404 });
  if (!sameOriginOnly(req)) return NextResponse.json({ error: "Request refused." }, { status: 403 });
  if (!(await rateLimit(`tg:verify:${await clientIp()}`, 30, 900))) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const jar = await cookies();
  const nonce = jar.get(CHALLENGE_COOKIE)?.value;
  if (!nonce || nonce.length > 40) return NextResponse.json({ error: "This login request has expired. Please start again." }, { status: 400 });
  const result = await verifyCode(nonce, parsed.data.code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  jar.delete(CHALLENGE_COOKIE);
  await startSession(result.userId);
  return NextResponse.json({ ok: true, next: safeNext(parsed.data.next) });
}
