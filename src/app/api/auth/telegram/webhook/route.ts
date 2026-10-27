import { NextResponse } from "next/server";
import { issueCode, sendTelegramMessage, telegramEnabled, webhookSecretMatches } from "@/lib/user-auth";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";

type Update = { message?: { text?: string; chat: { id: number; type: string }; from?: { id: number; first_name?: string; last_name?: string; username?: string } } };

/**
 * Telegram bot webhook (registered with `npm run telegram:webhook`). Telegram sends the secret in a
 * header; anything without it is rejected. Only "/start <nonce>" in a private chat does anything.
 */
export async function POST(req: Request) {
  if (!telegramEnabled() || !webhookSecretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) return new NextResponse(null, { status: 401 });
  const update = (await req.json().catch(() => null)) as Update | null;
  const msg = update?.message;
  if (!msg?.text || msg.chat.type !== "private" || !msg.from) return NextResponse.json({ ok: true });

  const m = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(msg.text.trim());
  if (!m) return NextResponse.json({ ok: true });
  if (!m[1]) {
    await sendTelegramMessage(msg.chat.id, `To log in, open the ${SITE_NAME} website, choose "Continue with Telegram", and tap the button there.`);
    return NextResponse.json({ ok: true });
  }
  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ").slice(0, 120);
  const code = await issueCode(m[1], { id: String(msg.from.id), name, username: msg.from.username ?? null });
  await sendTelegramMessage(
    msg.chat.id,
    code
      ? `Your ${SITE_NAME} login code is ${code}\n\nIt is valid for 10 minutes. Never share it with anyone. If you did not ask for it, ignore this message.`
      : `This login link has expired. Please go back to the ${SITE_NAME} website and start again.`,
  );
  return NextResponse.json({ ok: true });
}
