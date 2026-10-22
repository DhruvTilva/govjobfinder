import { NextResponse } from "next/server";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { NOTICE_KINDS, savedJobs } from "@/db/schema";
import { currentUser, sameOriginOnly } from "@/lib/user-auth";

export const runtime = "nodejs";

const MAX_SAVED = 200;
const item = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,200}$/),
  kind: z.enum(NOTICE_KINDS),
  title: z.string().min(1).max(400),
  applyEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  org: z.string().max(200).nullable(),
});

/** The logged-in visitor's saved jobs. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = await getDb();
  const rows = await db
    .select({ slug: savedJobs.slug, kind: savedJobs.kind, title: savedJobs.title, applyEnd: savedJobs.applyEnd, org: savedJobs.org })
    .from(savedJobs)
    .where(eq(savedJobs.userId, user.id))
    .orderBy(desc(savedJobs.savedAt));
  return NextResponse.json({ items: rows });
}

/** Replaces the visitor's saved list with the given one (the browser keeps the list in sync). */
export async function PUT(req: Request) {
  if (!sameOriginOnly(req)) return NextResponse.json({ error: "Request refused." }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = z.object({ items: z.array(item).max(MAX_SAVED) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved list." }, { status: 400 });
  const unique = [...new Map(parsed.data.items.map((i) => [i.slug, i])).values()];
  const db = await getDb();
  // The web app may run behind a transaction pooler where sql.begin() is unavailable, so this is two
  // idempotent steps: upsert what is in the list, then drop what is not. Two requests at once (two tabs,
  // a retry) cannot collide on the primary key or fail; the browser keeps pushing its full list, so the saved
  // list settles on the most recent one.
  if (unique.length) {
    const now = Date.now();
    // Earlier entries are newer in the browser list; keep that order via descending timestamps.
    await db
      .insert(savedJobs)
      .values(unique.map((i, idx) => ({ userId: user.id, ...i, savedAt: new Date(now - idx * 1000) })))
      .onConflictDoUpdate({
        target: [savedJobs.userId, savedJobs.slug],
        set: { kind: sql`excluded.kind`, title: sql`excluded.title`, applyEnd: sql`excluded.apply_end`, org: sql`excluded.org`, savedAt: sql`excluded.saved_at` },
      });
    await db.delete(savedJobs).where(and(eq(savedJobs.userId, user.id), notInArray(savedJobs.slug, unique.map((i) => i.slug))));
  } else {
    await db.delete(savedJobs).where(eq(savedJobs.userId, user.id));
  }
  return NextResponse.json({ ok: true, count: unique.length });
}
