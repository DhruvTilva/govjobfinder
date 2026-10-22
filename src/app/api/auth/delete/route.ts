import { NextResponse } from "next/server";
import { currentUser, deleteUser, sameOriginOnly } from "@/lib/user-auth";

export const runtime = "nodejs";

/** Deletes the visitor's account and everything stored for it (sessions, saved jobs). */
export async function POST(req: Request) {
  if (!sameOriginOnly(req)) return NextResponse.json({ error: "Request refused." }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await deleteUser(user.id);
  return NextResponse.json({ ok: true });
}
