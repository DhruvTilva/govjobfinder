import "./env";
import { siteUrl } from "@/lib/site";

// Registers the Telegram bot webhook (run once after deploying, and again if the domain changes).
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env first.");
  process.exit(1);
}
const url = siteUrl("/api/auth/telegram/webhook");
if (!url.startsWith("https://")) {
  console.error(`Telegram only delivers to https URLs. NEXT_PUBLIC_SITE_URL is ${siteUrl()} — set it to your real https domain.`);
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true }),
});
const body = (await res.json()) as { ok: boolean; description?: string };
console.log(body.ok ? `Webhook set to ${url}` : `Failed: ${body.description ?? res.status}`);
process.exit(body.ok ? 0 : 1);
