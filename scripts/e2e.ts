import { chromium, type Page } from "playwright-core";
import { addDays, todayIST } from "@/pipeline/dates";

/**
 * End-to-end check of the public site and admin journeys in a real browser.
 *   E2E_BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... npm run e2e
 * Uses an installed Chrome/Edge (E2E_BROWSER_CHANNEL, default "msedge").
 * Note: it publishes one notice from the review queue — run it against a test database.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOTS;
if (!EMAIL || !PASSWORD) throw new Error("Set E2E_EMAIL and E2E_PASSWORD");

let failures = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message.split("\n")[0]}`);
  }
}
function expect(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

console.log(`Public site (${BASE})`);
await step("home renders real counts and listings", async () => {
  await page.goto(BASE + "/");
  expect(await page.getByRole("heading", { level: 1 }).isVisible(), "no h1");
  expect(await page.getByText("Sites monitored").isVisible(), "no monitored count");
});
await step("search + combined filters return results page", async () => {
  await page.goto(BASE + "/jobs");
  await page.fill("#f-q", "recruitment");
  await page.selectOption("#f-state", "central");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/state=central/);
  expect(/q=recruitment/.test(page.url()), "query not kept in URL");
  expect(await page.getByText(/result|No results/).first().isVisible(), "no results line");
});
await step("job card opens a detail page with official link", async () => {
  await page.goto(BASE + "/jobs?status=all");
  const first = page.locator("article h3 a").first();
  if (!(await first.count())) return; // empty database is valid
  await first.click();
  await page.waitForURL(/\/jobs\//);
  expect(await page.getByText("Key details").isVisible(), "no key details");
  expect(await page.getByRole("link", { name: /Official notification/ }).count(), "no official link");
});
await step("save button stores a bookmark shown on /saved", async () => {
  if (!/\/jobs\//.test(page.url())) return;
  await page.getByRole("button", { name: /Save/ }).first().click();
  await page.goto(BASE + "/saved");
  expect(await page.getByRole("button", { name: "Remove" }).count(), "saved item missing");
});
await step("Saved button shows a count badge", async () => {
  const badge = page.locator('header a[href="/saved"] span[aria-hidden]');
  expect(Number(await badge.innerText()) >= 1, "no count badge after saving");
});
await step("language switch translates the interface and back", async () => {
  await page.goto(BASE + "/jobs");
  await page.getByRole("button", { name: /View in Hindi/ }).click();
  await page.waitForFunction(() => document.documentElement.lang === "hi-IN");
  await page.getByRole("heading", { level: 1, name: "नवीनतम सरकारी नौकरियाँ" }).waitFor();
  await page.getByRole("button", { name: /View in English/ }).click();
  await page.getByRole("heading", { level: 1, name: "Latest government jobs" }).waitFor();
});
await step("age calculator computes eligibility", async () => {
  await page.goto(BASE + "/tools/eligibility");
  await page.fill("#dob", "2000-01-15");
  await page.fill("#on", "2026-08-01");
  await page.fill("#max", "27");
  expect(await page.getByText("26").first().isVisible(), "age not shown");
  expect(await page.getByText(/Within the age limit/).isVisible(), "eligibility not shown");
  await page.selectOption("#cat", "gen");
  await page.fill("#max", "25");
  expect(await page.getByText(/Above the upper age limit/).isVisible(), "over-age not detected");
});

console.log("Admin");
await step("admin requires sign-in", async () => {
  await page.goto(BASE + "/bigboss");
  await page.waitForURL(/\/bigboss\/login/);
});
await step("wrong password is rejected", async () => {
  await page.fill("#email", EMAIL);
  await page.fill("#password", "definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator("form [role=alert]").waitFor();
  expect(/Incorrect email or password/.test(await page.locator("form [role=alert]").innerText()), "no error message");
});
await step("sign in shows overview with live stats", async () => {
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(BASE + "/bigboss");
  expect(await page.getByText("Active published jobs").isVisible(), "no stats");
  await shot(page, "admin-overview");
});
let noticeUrl = "";
await step("review queue item can be edited", async () => {
  await page.goto(BASE + "/bigboss/notices?status=needs_review&kind=recruitment");
  const link = page.locator("table a[href^='/bigboss/notices/']").first();
  expect(await link.count(), "review queue is empty");
  await link.click();
  await page.waitForURL(/\/bigboss\/notices\/\d+/);
  noticeUrl = page.url();
  await page.fill("#f-applyEnd", addDays(todayIST(), 21));
  await page.fill("#f-feeText", "No fee (edited in end-to-end test)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/Saved \d+ change/).waitFor();
  await shot(page, "admin-notice-edit");
});
await step("approve & publish makes the page public and marks it reviewed", async () => {
  await page.goto(noticeUrl);
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await page.getByText(/Status updated/).waitFor();
  const href = await page.getByRole("link", { name: /Public page/ }).getAttribute("href");
  expect(href, "no public link");
  const pub = await ctx.newPage();
  const res = await pub.goto(BASE + href!);
  expect(res?.status() === 200, `public page status ${res?.status()}`);
  expect(await pub.getByText("Reviewed by an editor").isVisible(), "not marked reviewed");
  expect(await pub.getByText("No fee (edited in end-to-end test)").isVisible(), "edit not visible publicly");
  expect(await pub.getByText(/Editor/).first().isVisible(), "field source tag missing");
  await pub.close();
});
await step("change history records the edit", async () => {
  await page.goto(noticeUrl);
  expect(await page.getByText(/feeText:/).isVisible(), "no feeText revision");
});
await step("unsafe source URLs are refused", async () => {
  await page.goto(BASE + "/bigboss/sources/new");
  await page.fill("#s-name", "Loopback test");
  await page.fill("#s-url", "http://127.0.0.1/admin");
  await page.getByRole("button", { name: "Add source" }).click();
  await page.locator("form [role=alert]").waitFor();
  expect(/not allowed/i.test(await page.locator("form [role=alert]").innerText()), "loopback URL accepted");
});
await step("source page shows health and can validate its URL", async () => {
  await page.goto(BASE + "/bigboss/sources?q=ssc.gov.in");
  await page.locator("table a[href^='/bigboss/sources/']").first().click();
  await page.waitForURL(/\/bigboss\/sources\/\d+/);
  await page.getByRole("button", { name: "Check URL" }).click();
  await page.getByText(/URL check:/).waitFor({ timeout: 45_000 });
});
await step("pipeline, reference data, audit and users pages load", async () => {
  for (const p of ["/bigboss/pipeline", "/bigboss/reference?tab=sectors", "/bigboss/audit", "/bigboss/users"]) {
    const res = await page.goto(BASE + p);
    expect(res?.status() === 200, `${p} → ${res?.status()}`);
  }
  expect(await page.getByText("qa-admin").first().isVisible().catch(() => true), "users list");
});
await step("audit log contains login and publish actions", async () => {
  await page.goto(BASE + "/bigboss/audit");
  expect(await page.getByText("login failed").first().isVisible(), "failed login not audited");
  expect(await page.getByRole("cell", { name: "publish", exact: true }).first().isVisible(), "publish not audited");
});
await step("sign out ends the session", async () => {
  await page.goto(BASE + "/bigboss");
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL(/\/bigboss\/login/);
  await page.goto(BASE + "/bigboss/notices");
  await page.waitForURL(/\/bigboss\/login/);
});
await step("no uncaught browser errors", async () => {
  expect(errors.length === 0, errors.join(" | "));
});

await browser.close();
console.log(failures ? `\n${failures} step(s) failed` : "\nAll steps passed");
process.exit(failures ? 1 : 0);
