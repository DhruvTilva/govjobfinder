import { chromium, type Page } from "playwright-core";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addDays, todayIST } from "@/pipeline/dates";

/**
 * Browser end-to-end check of the Website content manager (/bigboss/content) and its effect on
 * the public site. Creates, publishes, edits and deletes notices — run it against a test database:
 *   E2E_BASE_URL=http://localhost:3200 E2E_EMAIL=… E2E_PASSWORD=… E2E_EDITOR_EMAIL=… E2E_EDITOR_PASSWORD=… npx tsx scripts/e2e-content.ts
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3200";
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
if (!EMAIL || !PASSWORD) throw new Error("Set E2E_EMAIL and E2E_PASSWORD");
const tag = Date.now().toString(36);
const today = todayIST();

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

/** A small but valid PDF with real text, so the upload's text extraction is exercised. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);
  const stream = "BT /F1 12 Tf 50 780 Td 16 TL " + lines.map((l) => `(${esc(l)}) Tj T*`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const dir = mkdtempSync(path.join(tmpdir(), "gjf-e2e-"));
const pdfPath = path.join(dir, "advt-assistant-engineer.pdf");
writeFileSync(
  pdfPath,
  makePdf([
    "GOVERNMENT OF BIHAR",
    `Recruitment of Assistant Engineer Civil ${tag}`,
    "Advt. No. 77/2026",
    "Total Posts: 45",
    `Last date for receipt of online application: ${fmt(addDays(today, 12))}`,
    "Age Limit: 21 to 37 years",
    ...Array.from({ length: 20 }, (_, i) => `Clause ${i + 1}: candidates must apply online through the official portal only.`),
  ]),
);
const fakePdf = path.join(dir, "fake.pdf");
writeFileSync(fakePdf, "<html><body>not a pdf</body></html>");

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

const sel = async (p: Page, name: string, label: string) => {
  const s = p.locator(`select[name="${name}"]`);
  const value = await s.locator("option", { hasText: label }).first().getAttribute("value");
  await s.selectOption(value!);
};
const idFromUrl = (url: string) => Number(new URL(url).pathname.split("/").pop());
async function publicHas(pathname: string, text: string) {
  const res = await page.request.get(BASE + pathname);
  return (await res.text()).includes(text);
}

console.log(`Security (${BASE})`);
await step("content manager requires sign-in", async () => {
  const res = await page.request.get(BASE + "/bigboss/content", { maxRedirects: 0 });
  expect([302, 303, 307].includes(res.status()) && (res.headers()["location"] ?? "").includes("/bigboss/login"), `got ${res.status()}`);
});
await step("upload API refuses anonymous requests", async () => {
  const res = await page.request.post(BASE + "/bigboss/api/upload", { multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: makePdf(["x"]) } } });
  expect(res.status() === 401, `got ${res.status()}`);
});

console.log("Admin");
await page.goto(BASE + "/bigboss/login");
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/bigboss");

await step("existing admin tabs still load and the new tab is present", async () => {
  for (const [href, label] of [["/bigboss", "Overview"], ["/bigboss/notices?status=needs_review", "Review queue"], ["/bigboss/notices", "All notices"], ["/bigboss/sources", "Sources"], ["/bigboss/pipeline", "Pipeline"], ["/bigboss/reference", "Reference data"], ["/bigboss/audit", "Audit log"], ["/bigboss/users", "Users"], ["/bigboss/content", "Website content"]]) {
    const res = await page.goto(BASE + href);
    expect(res?.status() === 200, `${href} → ${res?.status()}`);
    expect(await page.locator("nav[aria-label=Admin]").getByRole("link", { name: label, exact: true }).count(), `nav link ${label}`);
  }
});

let jobId = 0;
const jobTitle = `Recruitment of Junior Engineer (Civil) ${tag}`;
await step("1. create a job manually and save it as a draft", async () => {
  await page.goto(BASE + "/bigboss/content/new?section=jobs");
  await page.fill('input[name="title"]', jobTitle);
  await sel(page, "organizationId", "BPSC");
  await sel(page, "stateId", "Bihar");
  await sel(page, "sectorId", "Engineering");
  await page.fill('input[name="notificationUrl"]', `https://bpsc.bihar.gov.in/advt/je-${tag}.pdf`);
  await page.fill('input[name="applyUrl"]', "https://onlinebpsc.bihar.gov.in/");
  await page.fill('input[name="applyEnd"]', addDays(today, 4));
  await page.fill('input[name="totalPosts"]', "120");
  await page.fill('textarea[name="qualificationText"]', "Diploma or degree in Civil Engineering");
  await page.fill('input[name="keywords"]', `jeciv${tag}`);
  await page.getByRole("button", { name: "Save as draft" }).click();
  await page.waitForURL(/\/bigboss\/content\/\d+\?saved=draft/);
  jobId = idFromUrl(page.url().split("?")[0]);
  expect(await page.getByText("Draft saved.").isVisible(), "no confirmation");
  expect(!(await publicHas("/jobs", jobTitle)), "draft is public");
});

await step("2. edit the draft and publish it", async () => {
  await page.fill('input[name="title"]', jobTitle + " (2026)");
  await page.getByRole("button", { name: "Save & publish" }).click();
  await page.getByText(/Saved and published/).waitFor();
});
const publishedTitle = jobTitle + " (2026)";

await step("3. job appears on the homepage, Latest Jobs, Closing Soon, state, sector and keyword results", async () => {
  expect(await publicHas("/", publishedTitle), "homepage");
  expect(await publicHas("/jobs", publishedTitle), "/jobs");
  expect(await publicHas("/jobs?status=closing&sort=closing", publishedTitle), "closing soon");
  expect(await publicHas("/jobs?state=bihar", publishedTitle), "state filter");
  expect(!(await publicHas("/jobs?state=punjab", publishedTitle)), "wrong state filter matched");
  expect(await publicHas("/jobs?sector=engineering", publishedTitle), "sector filter");
  expect(await publicHas(`/jobs?q=jeciv${tag}`, publishedTitle), "keyword search");
});

let jobPath = "";
await step("4. detail page shows the entered fields and official links, without empty placeholders", async () => {
  await page.goto(BASE + `/jobs?q=jeciv${tag}`);
  await page.getByRole("link", { name: publishedTitle }).first().click();
  await page.waitForURL(/\/jobs\/.+/);
  jobPath = new URL(page.url()).pathname;
  const body = await page.locator("main").innerText();
  expect(body.includes(publishedTitle), "title");
  expect(body.includes("120"), "posts");
  expect(body.includes("Diploma or degree in Civil Engineering"), "eligibility");
  expect(!/Not stated in notice|could not be read/i.test(body), "shows empty placeholders for a manual notice");
  expect(await page.locator(`a[href="https://bpsc.bihar.gov.in/advt/je-${tag}.pdf"]`).count(), "notification link");
  expect(await page.locator('a[href="https://onlinebpsc.bihar.gov.in/"]').count(), "apply link");
});

await step("5. editing a published notice updates the public page", async () => {
  await page.goto(BASE + `/bigboss/content/${jobId}`);
  await page.fill('input[name="totalPosts"]', "150");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/Saved 1 change/).waitFor();
  expect(await publicHas(jobPath, "150"), "public page not updated");
});

await step("stale edits from a second tab are refused", async () => {
  const other = await ctx.newPage();
  await other.goto(BASE + `/bigboss/content/${jobId}`);
  await page.goto(BASE + `/bigboss/content/${jobId}`);
  await page.fill('textarea[name="summary"]', "Edited in tab one");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/Saved 1 change/).waitFor();
  await other.fill('textarea[name="summary"]', "Edited in tab two");
  await other.getByRole("button", { name: "Save changes" }).click();
  await other.getByText(/changed this notice/).waitFor();
  await other.close();
});

await step("10. a duplicate notification is flagged before creation", async () => {
  await page.goto(BASE + "/bigboss/content/new?section=jobs");
  await page.fill('input[name="title"]', `JE Civil again ${tag}`);
  await page.fill('input[name="notificationUrl"]', `https://bpsc.bihar.gov.in/advt/je-${tag}.pdf`);
  await page.getByRole("button", { name: "Save as draft" }).click();
  await page.getByText("Possible duplicates:").waitFor();
  expect(await page.getByText("same official notification URL").isVisible(), "reason");
});

await step("15. a fake PDF is rejected with a clear message", async () => {
  await page.goto(BASE + "/bigboss/content/new?section=results");
  await page.setInputFiles('input[type="file"]', fakePdf);
  await page.getByText(/Only PDF files can be uploaded/).waitFor();
});

let pdfNoticeId = 0;
await step("7. upload a PDF, review extracted fields, save and publish with the PDF on the public page", async () => {
  await page.goto(BASE + "/bigboss/content/new?section=jobs");
  await page.setInputFiles('input[type="file"]', pdfPath);
  await page.getByText(/Found in the PDF/).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Fill empty fields" }).click();
  expect((await page.inputValue('input[name="title"]')).includes(`Assistant Engineer Civil ${tag}`), "title not prefilled");
  expect((await page.inputValue('input[name="applyEnd"]')) === addDays(today, 12), "last date not prefilled");
  expect((await page.inputValue('input[name="totalPosts"]')) === "45", "posts not prefilled");
  await sel(page, "stateId", "Bihar");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await page.waitForURL(/\/bigboss\/content\/\d+\?saved=draft/);
  pdfNoticeId = idFromUrl(page.url().split("?")[0]);
  const pdfHref = await page.locator('a[href^="/files/"]').first().getAttribute("href");
  expect(pdfHref, "attachment link in editor");
  await page.locator("form", { has: page.locator('button[name="action"][value="publish"]') }).locator('button[value="publish"]').click();
  await page.waitForURL(/status=publish/);
  await page.goto(BASE + `/jobs?q=${tag}`);
  await page.getByRole("link", { name: new RegExp(`Assistant Engineer Civil ${tag}`) }).first().click();
  await page.waitForURL(/\/jobs\/[^?]+$/);
  const link = page.getByRole("link", { name: /Notification \(PDF\)/ });
  expect(await link.count(), "PDF link on public page");
  const res = await page.request.get(BASE + (await link.getAttribute("href"))!);
  expect(res.status() === 200 && res.headers()["content-type"] === "application/pdf", `PDF served: ${res.status()}`);
});

await step("8. admit card, result, answer key and admission go to their own sections", async () => {
  for (const [section, pathName, title] of [
    ["admit-cards", "/admit-cards", `BPSC JE Admit Card ${tag}`],
    ["results", "/results", `BPSC JE Result ${tag}`],
    ["answer-keys", "/answer-keys", `BPSC JE Answer Key ${tag}`],
    ["admissions", "/admissions", `Bihar Polytechnic Admission ${tag}`],
  ] as const) {
    await page.goto(BASE + `/bigboss/content/new?section=${section}`);
    expect(!(await page.locator('input[name="applyEnd"]').count()), `${section} shows job-only fields`);
    await page.fill('input[name="title"]', title);
    await page.fill('input[name="notificationUrl"]', `https://bpsc.bihar.gov.in/${section}-${tag}.pdf`);
    await page.getByRole("button", { name: "Publish now" }).click();
    await page.waitForURL(/\/bigboss\/content\/\d+\?saved=publish/);
    expect(await publicHas(pathName, title), `${title} missing on ${pathName}`);
    expect(!(await publicHas("/jobs", title)), `${title} leaked into /jobs`);
  }
});

await step("9. content table filters by section, origin, state and keyword", async () => {
  await page.goto(BASE + `/bigboss/content?kind=result&origin=manual&q=${tag}`);
  expect(await page.getByRole("link", { name: `BPSC JE Result ${tag}` }).count(), "result not listed");
  expect(!(await page.getByRole("link", { name: publishedTitle }).count()), "job listed under results");
});

await step("site settings: banner and popular searches show on the public site", async () => {
  await page.goto(BASE + "/bigboss/content/settings");
  await page.fill('input[name="bannerText"]', `Exam calendar updated ${tag}`);
  await page.check('input[name="bannerActive"]');
  await page.locator('input[name="popEn"]').first().fill(`Agniveer${tag}`);
  await page.locator('input[name="popQ"]').first().fill("Agniveer");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Website settings saved.").waitFor();
  expect(await publicHas("/", `Exam calendar updated ${tag}`), "banner");
  expect(await publicHas("/", `Agniveer${tag}`), "popular search");
  await page.uncheck('input[name="bannerActive"]');
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Website settings saved.").waitFor();
  expect(!(await publicHas("/", `Exam calendar updated ${tag}`)), "banner still shown after deactivating");
});

await step("exam directory: add an exam and see it publicly", async () => {
  await page.goto(BASE + "/bigboss/content/exams");
  await page.fill('input[name="name"]', `Test Exam ${tag}`);
  await page.fill('input[name="group"]', "Central");
  await page.getByRole("button", { name: "Add exam" }).click();
  await page.getByText("Exam saved.").waitFor();
  expect(await publicHas("/exams", `Test Exam ${tag}`), "exam not on /exams");
});

await step("6. unpublish and archive remove a notice from public pages", async () => {
  await page.goto(BASE + `/bigboss/content/${jobId}`);
  await page.locator('button[value="unpublish"]').click();
  await page.waitForURL(/status=unpublish/);
  expect((await page.request.get(BASE + jobPath)).status() === 404, "unpublished detail page still public");
  expect(!(await publicHas("/jobs", publishedTitle)), "still listed");
  await page.locator('button[value="archive"]').click();
  await page.waitForURL(/status=archive/);
  expect(await page.locator("text=archived").first().isVisible(), "not archived");
});

await step("bulk archive from the content table", async () => {
  await page.goto(BASE + `/bigboss/content?q=${tag}&kind=admit_card`);
  await page.locator('input[name="ids"]').first().check();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.waitForURL(/bulk=archive&n=1/);
  expect(!(await publicHas("/admit-cards", `BPSC JE Admit Card ${tag}`)), "still public after bulk archive");
});

await step("drafts' attachments are not public", async () => {
  await page.goto(BASE + `/bigboss/content/${pdfNoticeId}`);
  const href = (await page.locator('a[href^="/files/"]').first().getAttribute("href"))!;
  await page.locator('button[value="unpublish"]').click();
  await page.waitForURL(/status=unpublish/);
  const anon = await browser.newContext();
  const res = await anon.request.get(BASE + href);
  expect(res.status() === 404, `anonymous got ${res.status()}`);
  await anon.close();
});

if (process.env.E2E_EDITOR_EMAIL) {
  await step("14. an editor (not admin) cannot delete", async () => {
    const ed = await browser.newContext();
    const p = await ed.newPage();
    await p.goto(BASE + "/bigboss/login");
    await p.fill('input[name="email"]', process.env.E2E_EDITOR_EMAIL!);
    await p.fill('input[name="password"]', process.env.E2E_EDITOR_PASSWORD!);
    await p.click('button[type="submit"]');
    await p.waitForURL(BASE + "/bigboss");
    await p.goto(BASE + `/bigboss/content/${jobId}`);
    await p.fill('input[name="confirm"]', "DELETE");
    await p.getByRole("button", { name: "Delete permanently" }).click();
    await p.waitForLoadState("networkidle");
    await ed.close();
    const res = await page.goto(BASE + `/bigboss/content/${jobId}`);
    expect(res?.status() === 200, "notice was deleted by an editor");
  });
}

await step("delete requires typing DELETE, then removes the notice", async () => {
  await page.goto(BASE + `/bigboss/content/${jobId}`);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForURL(/error=confirm/);
  await page.fill('input[name="confirm"]', "DELETE");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForURL(/deleted=1/);
  expect((await page.goto(BASE + `/bigboss/content/${jobId}`))?.status() === 404, "still exists");
});

await step("no client-side errors", async () => {
  expect(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await browser.close();
console.log(failures ? `\n${failures} step(s) failed` : "\nAll steps passed");
process.exit(failures ? 1 : 0);
