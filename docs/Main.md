# GovJobFinder

Indian government job notifications collected directly from official recruitment websites — central, all 28 states and 8 Union Territories — with last dates, eligibility, provenance and the official notification link on every listing.

## What's in the box

**Public site** (no login needed)
- Home: latest recruitments, closing soon, admit cards / results / answer keys, browse by state, sector and qualification — all counts are live database values.
- `/jobs`: keyword search (full-text + organisation/advt-number match) with combinable filters: state/central, sector, qualification, application status, job type, posted date, sort. Works without JavaScript; every filter combination is a shareable URL.
- Job pages: key facts with *"Not stated in notice"* instead of guesses, field-level provenance (from notice / AI-assisted / editor), official links with domain check, linked admit cards and results, change history (deadline extensions, cancellations), JSON-LD `JobPosting`.
- State, sector, organisation and qualification hubs with their official recruitment websites; technical exam directory; age-eligibility calculator; browser-only saved jobs; filterable RSS feeds (`/feed.xml?state=bihar&qual=12th-pass`) as a free alert channel; sitemap and robots.

**Collector** (`npm run pipeline`, scheduled via GitHub Actions)
- ~160 configured sources from the supplied reference files, each with priority, interval, trust level and optional CSS selector / include / exclude patterns (editable in the admin).
- Polite, safe fetching (robots.txt, per-host spacing, SSRF protection, size/time limits, TLS chain completion), link harvesting, PDF/HTML text extraction, deterministic extraction of dates, advt no., posts, age, fee, pay, qualifications; optional Claude-assisted extraction.
- Duplicate control (normalised-URL and document-hash fingerprints, same-advertisement detection), corrigendum / extension / cancellation handling, follow-up linking, automatic closing after the last date, retries with backoff, source health tracking, run logs.
- Conservative auto-publish rules; everything uncertain goes to a review queue with reasons.

**Admin** (`/admin`)
- Overview of real operational stats, review queue with bulk actions, full notice editor with preview and source evidence, source management with *Scan now* / *Check URL*, pipeline runs and failures, reference data editing, users with roles, audit log.

## Quick start (local)

```bash
npm install
npm run db:seed                                      # local embedded Postgres (PGlite) + reference data
npm run admin:create -- --email you@example.com      # prompts for a password
npm run dev                                          # http://localhost:3000, admin at /admin
npm run pipeline -- --max 10                         # collect from 10 sources (stop `dev` first when using PGlite)
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js app |
| `npm test` | Unit + integration tests (in-memory PostgreSQL) |
| `npm run typecheck` | TypeScript |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / insert missing reference data (idempotent) |
| `npm run pipeline` | One collection pass (`--source 12,15`, `--max`, `--budget <min>`, `--reprocess-review`) |
| `npm run sources:validate` | Check every source URL and record its status |
| `npm run admin:create` | Create or reset an admin/editor account |
| `npm run e2e` / `e2e:cleanup` | Browser end-to-end checks (installed Edge/Chrome; publishes one notice with test data — run against a test database, then `e2e:cleanup`) |
| `npx tsx scripts/qa-report.ts` · `inspect.ts` · `sample-text.ts` · `check-url.ts` | Data-quality tools: review-reason summary, notice dump, text snippets for tuning extractors, one-off URL check |

## Documentation

- [PLAN.md](PLAN.md) — Phase 1 assessment: scope, competitive findings, architecture, risks.
- [OPERATIONS.md](OPERATIONS.md) — deployment, environment, scheduling, costs, backups, security, runbook.
- [DATA_SOURCES.md](DATA_SOURCES.md) — how the supplied reference files were used, corrections made, URL validation results.
- [HANDOVER.md](HANDOVER.md) — final report: delivered features, test results, limitations, next steps, go-live checklist.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL (Supabase) via Drizzle ORM · PGlite for local/tests · undici · cheerio · unpdf · Zod · Vitest · Playwright (e2e).
