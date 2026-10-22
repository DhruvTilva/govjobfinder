import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clientIp, rateLimit } from "@/lib/auth";
import { googleEnabled, googleExchange, OAUTH_COOKIE, safeNext, startSession, upsertGoogleUser } from "@/lib/user-auth";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(siteUrl(`/login?error=${code}`));
  if (!googleEnabled()) return fail("config");
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete(OAUTH_COOKIE);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error") || !raw || !code || !state) return fail("google");
  if (!(await rateLimit(`oauth:cb:${await clientIp()}`, 30, 900))) return fail("rate");
  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return fail("google");
  }
  if (saved.state !== state) return fail("google");
  const profile = await googleExchange(code, saved.verifier);
  if (!profile) return fail("google");
  await startSession(await upsertGoogleUser(profile));
  return NextResponse.redirect(siteUrl(safeNext(saved.next)));
}
