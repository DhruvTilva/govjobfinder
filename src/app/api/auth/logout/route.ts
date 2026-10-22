import { NextResponse } from "next/server";
import { endSession, sameOriginOnly } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOriginOnly(req)) return NextResponse.json({ error: "Request refused." }, { status: 403 });
  await endSession();
  return NextResponse.json({ ok: true });
}
