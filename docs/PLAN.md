# GovJobFinder — Phase 1 Assessment & Plan

Date: 2026-10-15

## 1. Scope and core user journeys

**Candidate (no login):** Discover → understand eligibility & deadline → open the official notice → apply on the official portal.

1. Land on home → see what's new and what closes soon → open a notice.
2. Search ("SSC", "JE", "nursing Bihar") → combine filters (state, sector, qualification, status, deadline) → open a notice.
3. Browse by state / sector / organisation / qualification → open a notice.
4. On a notice page: key facts (last date, posts, qualification, age, fee) with each field marked as
   *from the notice* or *not stated*, official PDF + apply links with their domains shown, timeline of
   follow-ups (admit card → answer key → result) for the same recruitment.

**Admin:** review queue → approve/correct/reject; manage sources, taxonomy and organisations; trigger/inspect pipeline runs; see source health.

## 2. Competitive findings

| | SarkariResult | MySarkariNaukri (≈ demo-site.html layout) |
|---|---|---|
| Listing fields | Title only (no dates, no org field) | Org, posts, last date, PDF link |
| Filters | None | State + 8 sectors only |
| Freshness | No dates anywhere; stale items in lists | "Updated every 2 minutes" claim, static dates |
| Duplicates | Same exam repeated across 3–4 sections | Featured items repeated in feed |
| Source transparency | Links to own pages, a tinyurl, other domains | PDF links, some non-gov domains despite "exclusively .gov.in" claim |
| Trust copy | Keyword-stuffed SEO text, repeated disclaimers | "Verified" badge vs. "not affiliated" disclaimer |

**What we adopt:** category axis (jobs / admit card / result / answer key), state + sector hubs, prominent last date, official PDF on every card.

**Where we differentiate:**
1. **Provenance on every notice:** source page, discovery time, last checked time, link domain shown and flagged if not an official domain.
2. **One recruitment, one page, with a timeline:** admit cards / results attach to their parent recruitment instead of being duplicated across lists.
3. **Honest fields:** "Not stated in notice" instead of blanks or guesses; no fabricated counters.
4. **Real combined filters** (state × sector × qualification × status × deadline) that work on mobile.
5. **Lifecycle:** automatic "Closed" after last date, "Deadline extended" and "Cancelled" states, change history.

## 3. Data collection strategy

Government sites rarely offer APIs or RSS. Practical, legitimate approach:

* **Source registry** (DB table) — one row per monitored listing page (e.g. `ssc.gov.in` notices page). Seeded from the three supplied files (≈150 bodies).
* **Generic link-harvester adapter** — fetch listing page, extract anchors, keep those whose text/URL matches recruitment vocabulary, resolve to absolute URLs, restricted to the source's allowed domains. Per-source config (JSON) can narrow by CSS selector and include/exclude patterns, so new sources need **no code**.
* **RSS / sitemap adapters** where a source provides them.
* **Document extraction** — fetch the linked PDF/HTML (size-capped), extract text (`unpdf` / `cheerio`), run **deterministic extractors** (dates, advt no., vacancies, fee, age, qualifications) with confidence scores.
* **Optional LLM assist** (Claude, only if `ANTHROPIC_API_KEY` is set) to fill fields the regexes miss; outputs are schema-validated and **never** decide authenticity.
* **Politeness & safety** — robots.txt honoured, per-host concurrency 1 and delay, timeouts, size limits, conditional requests (ETag / Last-Modified / content hash), SSRF guard (http/https only, public IPs only, domain allow-list).

Not scraped: aggregator sites (incl. the two reference sites). We only collect from official bodies.

## 4. Architecture

| Concern | Choice | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript + Tailwind** | SSR/ISR for SEO, server actions for admin, one codebase |
| DB | **PostgreSQL** (Supabase free tier in prod) via **Drizzle ORM** | Relational data, full-text search (`tsvector`), migrations in git |
| Local dev / tests | **PGlite** (Postgres in WASM) when `DATABASE_URL` unset | Runs with zero accounts; same SQL dialect |
| Admin auth | Own auth: bcrypt hashes in DB, signed httpOnly session cookie (jose), login rate-limit, audit log | No vendor lock-in, works locally; browser never touches DB |
| Pipeline | Node/TS worker (`npm run pipeline`) on **GitHub Actions cron** | Free, secrets management, no execution-time limit issues of serverless |
| Admin "scan now" | Single-source scan inline (time-boxed) + full-run request queued for the next worker run | Avoids long serverless calls |
| Documents | Store **URL + hash + extracted text excerpt**, not PDF copies | Keeps DB small; official PDF stays canonical |

Supabase's PostgREST API is not used. RLS is enabled with **no policies** on every table so the public anon key (if ever exposed) can read nothing; the app connects with a server-side connection string only.

## 5. Data model (core)

`states`, `sectors`, `qualifications`, `organizations` (→ state, sector), `sources` (→ organization; adapter config, priority, interval, health), `notices` (kind: recruitment/admit_card/result/answer_key/syllabus/exam_date/other; status lifecycle; parent_id for timeline; field-level provenance JSON), `notice_qualifications`, `notice_revisions`, `discoveries` (raw harvested links, fingerprint unique), `pipeline_runs`, `pipeline_events`, `admin_users`, `admin_sessions`, `audit_log`, `exams` (technical exam directory from Top-50 file).

**Notice lifecycle:** `discovered → extracted → (auto_published | needs_review) → published / reviewed → updated → closed | cancelled | withdrawn | rejected | archived`. Display status (open / closing soon / closed / upcoming) is derived from dates at query time.

**Auto-publish eligibility (all required):** source trust level = `trusted`, link on an allowed official domain, document fetched OK, classified as a known kind with confidence ≥ threshold, title present, not a duplicate, and for recruitments a parsed closing date in the future. Everything else → review queue. Badge text is "Auto-published from official source", never "Verified" unless an admin reviewed it.

## 6. Cost & operations (verify on provider pages before launch)

* Supabase Free: small DB quota (~500 MB), projects pause after a period of inactivity — the scheduled pipeline keeps it active; no PITR backups on free → we add a `pg_dump` GitHub Action to artifacts.
* GitHub Actions: free for public repos; private repos have a monthly minute quota — a ~3 min run every 2 h ≈ 1,100 min/month.
* Vercel Hobby is non-commercial; if ads/monetisation are added, move to Vercel Pro or a self-hosted Node server / Cloudflare.
* Claude API is optional and pay-per-use; pipeline works without it.

## 7. Phases & acceptance (summary)

1 Plan (this doc) · 2 Foundation (app runs, migrations, seed) · 3 Public site · 4 Source directory + ingestion · 5 Admin · 6 Scheduled automation · 7 SEO + candidate tools · 8 QA/security tests · 9 Deployment docs/workflows · 10 Handover report. Acceptance criteria per the brief.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gov sites slow/down/geo-blocked (UPSC timed out in testing) | timeouts, retries with backoff, per-source health, never delete on disappearance |
| Site redesigns break harvesting | generic adapter + per-source config editable in admin; health alerts |
| Wrong extraction published | auto-publish only with strict rules; field provenance; review queue |
| Fake/phishing domains | official-domain allow-list per source; non-official domains flagged |
| Thin/duplicate pages hurt SEO | one page per recruitment, noindex for drafts and empty filters, canonical URLs |
| Free tier limits | small DB footprint (no PDF storage), documented upgrade path |

## 9. Issues found in the supplied reference files

* **State workbook:** all four copies are byte-identical. `HPRCA` row points to the old `hpsssb.hp.gov.in` (body dissolved; replaced by HPRCA). "APPSC" used for both Andhra Pradesh and Arunachal Pradesh. SEBA is an exam board, not a recruiter (it runs ADRE). All URLs marked "Not checked" — validated by `npm run sources:validate`.
* **Top-50 workbook:** Sheet1 and Sheet2 hold the same rows (Sheet2 is a formatted copy). Row 36 (ED) has link and notification-month columns swapped. #23 DFO is mapped to NTRO but is recruited by the Cabinet Secretariat. #38 "Income Tax Inspector (IT Assessment)" — "IT" means Income Tax, not information technology. #22 IRSSE and #48 IRPS were merged into the Indian Railway Management Service (IRMS). #34 BBNL has been merged into BSNL. #50 "State-Level IT Officer/MNC" is not a government post. Salary and difficulty figures are unsourced → stored but **not shown as fact**.
* **Sector document:** uses `ssc.gov.in` (current) while Top-50 uses `ssc.nic.in` (old) — normalised to `ssc.gov.in`.
