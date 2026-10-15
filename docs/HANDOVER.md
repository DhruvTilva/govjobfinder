# GovJobFinder — Handover Report

Date: 2026-10-15 · Status: **built and verified locally; not yet deployed** (needs your Supabase, GitHub and Vercel accounts — steps in [OPERATIONS.md §3](OPERATIONS.md#3-first-deployment-step-by-step)).

## 1. What was delivered (by phase)

| Phase | Result |
|---|---|
| 1 Discovery | [PLAN.md](PLAN.md): competitive analysis of SarkariResult and MySarkariNaukri (the supplied `demo-site.html` mirrors the latter's layout), architecture, data model, risks; every row of the three reference files inspected, issues listed in [DATA_SOURCES.md](DATA_SOURCES.md). |
| 2 Foundation | Next.js 16 + TypeScript + Tailwind 4, Drizzle schema (17 tables) and migrations incl. RLS lockdown, PGlite for zero-account local dev, idempotent seed. |
| 3 Public site | Home, latest jobs with search + 8 combinable filters + sort + pagination, job and update detail pages, admit cards / results / answer keys / schedules, 36 state pages, 18 sector pages, organisation and qualification pages, exam directory, age calculator, saved jobs, about/FAQ, 404/error states, mobile layouts. |
| 4 Sources & ingestion | 154 organisations / 159 sources from the files + research; URL validator; collector with link harvesting, PDF/HTML extraction, deterministic field extraction, dedupe, amendments. |
| 5 Admin | Secure sign-in, overview stats, review queue with reasons and bulk actions, notice editor with preview, evidence and history, source management with Scan now / Check URL, pipeline controls, reference data, users/roles, audit log. |
| 6 Automation | GitHub Actions schedule (every 2 h), per-source intervals and backoff, retries, stale-run recovery, single-run lock, change detection, auto-close after last date, reprocessing after rule changes. |
| 7 SEO & extras | Canonicals, noindex for filtered variants, sitemap (468 URLs locally), robots, breadcrumbs + BreadcrumbList, JobPosting / WebSite / FAQPage JSON-LD, filterable RSS feeds (alert channel), real 404s, Mumbai region pinning. |
| 8 QA & security | Tests below; security review items in [OPERATIONS.md §9](OPERATIONS.md#9-security-notes). |
| 9 Deployment prep | CI, collector and backup workflows, `vercel.json`, env templates, deployment and recovery runbook. |

## 2. Tests actually executed

| Test | Result |
|---|---|
| `npm test` — 47 unit + integration tests (dates, classification incl. real titles from ISRO/DRDO/HSSC/GPSC/MPSC, field extraction, harvesting, title tidying, SSRF guard incl. DNS-rebinding, robots.txt, URL normalisation, pipeline on in-memory Postgres: auto-publish, duplicate document, deadline extension, follow-up linking, review routing, non-official domain, archiving, retry, reprocessing, expiry, fingerprint uniqueness) | **47/47 pass** |
| `npm run typecheck`, `next build` | Pass |
| `npm run e2e` — 17 browser steps in Edge (public search/filters/detail/save/calculator; admin auth incl. wrong password, edit, publish, public reflection, history, unsafe-URL rejection, source URL check, all admin pages, audit, sign-out) | **17/17 pass** |
| HTTP checks: all public routes 200, unknown slugs 404, wrong-prefix 308, sitemap/robots/RSS/headers | Pass |
| Live source validation (from India) | 131 of 159 URLs load (was 104 before fetcher fixes) |
| Live collection (2 runs, ~1,000 links from 66+ sites) | 232 notices auto-published, 326 queued for review with reasons, 76 old adverts archived, 21 corrigenda/extensions applied to originals, 40 duplicates caught |
| `npm audit --omit=dev` | 0 vulnerabilities (4 moderate in dev-only `drizzle-kit` → esbuild dev server, not used) |

Bugs found and fixed during testing include: 404 pages returning 200 (Suspense streaming), React 19 form reset wiping the login email and unsaved editor changes, trailing-slash URLs escaping duplicate detection, titles merged from multi-link rows, follow-up notices receiving application deadlines, missing TLS intermediates on ~15 government sites.

## 3. Honest limitations

1. **Extraction coverage.** Of auto-published recruitments, every one has an official link and closing date, but vacancy counts were found for only 1 of 23 (they usually sit in tables), qualification text for about a third, and age limits or fees for under a fifth. Pages say "Not stated in notice" rather than guess.
2. **Review backlog.** The main causes: no closing date found (185), scanned or non-Unicode Indian-language PDFs (127), uncertain notice type (39). An editor is needed for these until extraction improves.
3. **Unreachable sources.** UPSC, MHA, Supreme Court, MeitY block automated access (HTTP 403); ~10 sites time out; a few have expired certificates or dead hostnames. Not bypassed.
4. **Geo-restrictions untested from GitHub's runners** (all tests ran from an Indian connection). See OPERATIONS §6 for the self-hosted-runner fallback.
5. **Not built (deliberately deferred):** email/push alerts (RSS feeds provided instead), accounts for candidates, Hindi/regional UI, syllabus/exam-pattern content pages, advertising.
6. The AI-assisted extraction path is implemented and type-checked but was **not exercised against the live API** (no key was available). The pipeline runs fully without it.

## 4. Highest-value next steps

1. **Read scanned/Indian-language PDFs with Claude's PDF input** (send the PDF itself instead of extracted text) — targets the largest review bucket.
2. Set CSS selectors on the top ~30 sources so only the notice block is harvested (cuts "uncertain type" and garbled titles).
3. Add remaining state police, health and teacher recruitment boards; switch sources from *review* to *trusted* as their output proves reliable.
4. Email alerts (double opt-in, unsubscribe link) via a transactional email provider once traffic justifies it.
5. Retention job for `discoveries.doc_text` (see OPERATIONS §7).

## 5. To go live — what I need from you

| Item | Why |
|---|---|
| Supabase project (Mumbai) | Production database |
| GitHub repository + secrets `WORKER_DATABASE_URL` (+ optional `ANTHROPIC_API_KEY`) | Scheduled collection and backups |
| Vercel project (Pro if any monetisation) + `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` | Hosting |
| Domain name | Canonical URLs, Search Console |
| Your admin email | `npm run admin:create` against production |

Then follow OPERATIONS §3 step by step, including the verification commands — deployment should not be considered done until those pass against the live URL.

## 6. Local state left on this machine

* `./.data/pglite` — local database with live-collected data from 2026-10-15 and a local-only test admin `qa-admin@localhost.test` (password only in the session's temp folder). Delete the folder to start fresh (`npm run db:seed` recreates it).
* Notices edited by the e2e test were reverted with `npm run e2e:cleanup` (marked *rejected* with an explanatory note).
* Nothing has been committed to git yet.
