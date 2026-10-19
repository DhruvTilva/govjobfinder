# GovJobFinder — Deployment & Operations

This is the runbook for deploying and running GovJobFinder. It assumes no prior knowledge of the codebase.

## 1. Architecture at a glance

```
            ┌───────────────────────────────┐
 Visitors ─▶│ Next.js web app (Vercel, bom1)│──┐  reads/writes via
 Admins   ─▶│  public site + /admin         │  │  transaction pooler
            └───────────────────────────────┘  ▼
                                         ┌──────────────┐
                                         │  PostgreSQL   │  Supabase (Mumbai)
                                         │  (Supabase)   │  RLS on, no public API use
                                         └──────────────┘
            ┌───────────────────────────────┐  ▲
 Schedule ─▶│ Collector worker              │──┘  direct / session connection
 (every 2h) │ GitHub Actions: npm run pipeline│
            └───────────────────────────────┘
                     │ polite HTTPS fetches (robots.txt, 1.5 s/host)
                     ▼
            Official government websites (~150)
```

* **Web app** — server-rendered on every request (no stale caches of deadlines). Never touches government websites except for the admin "Scan now"/"Check URL" buttons.
* **Collector** — `scripts/pipeline.ts`: scans due sources, harvests links, fetches documents, extracts fields, validates, publishes or queues for review, closes expired notices. Incremental, resumable and safe to re-run (unique fingerprints on links and notices; a stale-run detector; one run at a time).
* **Database** — the only shared state. Drizzle migrations live in `drizzle/`.

## 2. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Web app (Vercel, local dev server) | Supabase **transaction pooler** URL (port 6543). Required in production. On port 6543 the client disables query pipelining (see §2.1). |
| `DATABASE_POOL_MAX` | Web app | Connections per server instance (default 5; use 3 on Vercel). |
| `WORKER_DATABASE_URL` (local `.env.local`) | CLI scripts | Session pooler URL (port 5432). When set, `npm run pipeline`, `db:migrate`, `db:seed` and the other scripts use it instead of `DATABASE_URL`, so one `.env.local` serves both the dev server and the collector. |
| `NEXT_PUBLIC_SITE_URL` | Web app | Public base URL, e.g. `https://govjobfinder.in`. Used for canonical URLs, sitemap, RSS. |
| `WORKER_DATABASE_URL` | GitHub secret | Supabase **session pooler or direct** URL (port 5432) for the collector, migrations and backups. |
| `CRAWLER_USER_AGENT` | GitHub variable | Identifies the crawler, include a contact URL, e.g. `GovJobFinderBot/1.0 (+https://govjobfinder.in/about)`. |
| `ANTHROPIC_API_KEY` | GitHub secret (optional) | Enables AI-assisted filling of fields the rules miss. Pipeline works without it. |
| `ANTHROPIC_MODEL` | GitHub variable (optional) | Defaults to `claude-opus-5-5`. Set a different model id for another cost/quality trade-off. |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` | Web app (optional) | Lets "Run pipeline now" in the admin start the GitHub workflow immediately (fine-grained token with *Actions: write* on this repo only). Without it, requests are queued for the next scheduled run. |
| `GITHUB_DISPATCH_REF` | Web app (optional) | Branch the workflow is dispatched on (default `master`). |
| `COLLECT_RUNNER` | GitHub variable (optional) | Runner label for the collector (see §6, geo-restrictions). |

Never put the database URL or API keys in `NEXT_PUBLIC_*` variables — those are sent to browsers.

### 2.1 Supabase connections (read this before changing `src/db/client.ts`)

Verified against the project on 2026-10-19:

* **Two URLs, two jobs.** The web app uses the transaction pooler (6543); the collector, migrations and seed use the session pooler (5432). The session pooler allows only `pool_size` (15 on this plan) simultaneous clients for the whole project, so a web app on 5432 runs out of connections quickly.
* **No pipelining on 6543.** With postgres.js's default pipelining, Supavisor's transaction mode left connections hanging (backend stuck in `ClientRead`, page requests never returning) as soon as ~5 queries queued on one connection — every page does that. The client sets `max_pipeline: 0` on port 6543 (postgres.js treats 1 as "two in flight"). That setting also disables `sql.begin()`, which the web app does not use; migrations refuse to run on 6543 with an explicit error.
* **One pool per process.** `getDb()` creates the pool once behind a shared promise. (An earlier version created a pool per concurrent caller, which leaked connections until the pooler refused new clients.)
* **Passwords containing `@`, `:` or `/`** should be percent-encoded in the URL (`@` → `%40`).

## 3. First deployment (step by step)

1. **Supabase**: create a project in region *Mumbai (ap-south-1)*. From *Project Settings → Database* copy the transaction pooler URL (6543) and the session pooler URL (5432).
2. **Schema + reference data** (from your machine):
   ```bash
   DATABASE_URL="<session pooler URL>" npm run db:seed        # runs migrations, loads states/sectors/sources/exams
   # If the tables were created by pasting the SQL into the Supabase editor, the migration log is
   # empty and db:seed fails with "relation already exists" — record the applied migrations instead
   # of dropping anything (see §10, "Migration log out of sync").
   DATABASE_URL="<session pooler URL>" npm run sources:validate # optional: records which source URLs load
   DATABASE_URL="<session pooler URL>" npm run admin:create -- --email you@example.com --name "Your Name"
   ```
   `admin:create` prompts for a password (min 12 characters); it is never stored in shell history.
3. **GitHub**: push the repository. Add secret `WORKER_DATABASE_URL` (session URL), optional `ANTHROPIC_API_KEY`; add variable `CRAWLER_USER_AGENT`. Then run *Actions → Collect notices → Run workflow* once and confirm a run appears in */admin/pipeline*.
4. **Vercel**: import the repository. Set `DATABASE_URL` (transaction URL), `DATABASE_POOL_MAX=3`, `NEXT_PUBLIC_SITE_URL`. `vercel.json` pins functions to Mumbai (`bom1`) so database round-trips stay short.
5. **Domain**: add it in Vercel, then update `NEXT_PUBLIC_SITE_URL` and redeploy. Submit `https://<domain>/sitemap.xml` in Google Search Console.
6. **Verify the deployment** (don't assume):
   ```bash
   curl -I https://<domain>/            # 200
   curl -I https://<domain>/jobs/nope   # 404
   curl -I https://<domain>/admin       # 307 → /admin/login
   curl -s https://<domain>/robots.txt  # disallows /admin
   E2E_BASE_URL=https://<domain> E2E_EMAIL=... E2E_PASSWORD=... npm run e2e   # against a staging database only
   ```

## 4. Day-to-day operation (admin dashboard)

| Task | Where |
|---|---|
| Check health: last run, failing sources, review backlog | `/admin` |
| Review uncertain notices (reason shown for each) | `/admin/notices?status=needs_review` — open, correct fields, *Approve & publish*; or bulk-publish/reject |
| Mark cancelled / withdrawn / closed | Notice page → status buttons (history is kept; nothing is deleted) |
| Add a notice the pipeline can't read | `/admin/notices/new` |
| Fix a source (new URL, CSS selector, include/exclude patterns, trust) | `/admin/sources/<id>` → edit → *Scan now* to test |
| Add a new official website | `/admin/sources/new` (starts as "review every notice"; switch to *Trusted* once results look right) |
| Run everything now / retry failures | `/admin/pipeline` |
| After improving extraction rules | `/admin/pipeline` → *Re-run extraction on review queue* (only unedited auto items) |
| Taxonomy (sectors, qualifications, organisations, state notes) | `/admin/reference` |
| Who changed what | `/admin/audit`; per-notice history on each notice page |

**Publication rules** (automatic): a notice is published only if its source is *Trusted*, the link is on an official domain (`.gov.in`, `.nic.in` or the organisation's own domain), the document was fetched and readable, the notice type is clear, and (for recruitments) a closing date in the next ~13 months was found. Everything else waits in the review queue with the reason. Old advertisements without a current date are archived, not queued.

## 5. Scheduling

* Each source records the outcome of its latest check (`last_check_status`): *never checked*, *checking now*, *ok, new notices*, *ok, nothing new*, *partial* (listing loaded but some documents failed), *failed*; disabled sources are shown as disabled. Counts are on `/admin`, filters on `/admin/sources`.
* A source left at *checking* by a crashed or cancelled run is set to *failed* ("Check was interrupted") at the start of the next run.
* `collect.yml` runs every 2 hours (`17 */2 * * *`). Each source has its own interval (priority 1: 2 h, 2: 6 h, 3: 12 h), so a run only scans sources that are due. Failing sources back off exponentially (up to 3 days) and appear in */admin* after 3 consecutive failures.
* Runs heartbeat every 30 s; a run without a heartbeat for 30 min is marked failed so the next run can proceed.
* GitHub may delay scheduled runs at busy times and, for repositories without activity for 60 days, may disable scheduled workflows ([GitHub docs](https://docs.github.com/en/enterprise-server@3.20/actions/using-workflows/disabling-and-enabling-a-workflow)). If the admin overview shows "Last successful pipeline run" older than ~6 hours, check *Actions*.

## 6. Known operational risks

* **Geo-restrictions / bot protection.** In testing from an Indian connection on 2026-10-15, 131 of 159 source URLs loaded (82%); UPSC, MHA and the Supreme Court returned HTTP 403 (bot protection), two sites had expired certificates and about ten timed out. GitHub's hosted runners are outside India, so more sites may refuse them. If source failures jump after moving to GitHub Actions: register a [self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) on a small VM in India (or an always-on PC) and set repository variable `COLLECT_RUNNER=self-hosted`. We do **not** bypass bot protection; such sources stay as reference links and their notices can be added manually or via Employment News.
* **TLS problems on government sites** are handled without disabling verification: missing intermediate certificates are fetched via the certificate's AIA URL, and legacy renegotiation is allowed. Expired certificates are reported as failures.
* **Regional-language notices** (Kannada, Gujarati, Hindi PDFs, scanned PDFs) are not extracted by the rules and go to review. Enabling `ANTHROPIC_API_KEY` improves field filling for text PDFs; scanned PDFs still need an editor.
* **robots.txt** is respected for every request. Some sites disallow their PDF folders (e.g. HPSC `/Portals/0/`); those notices enter review with the reason "blocked by the site's robots.txt".

## 7. Costs (check provider pages before launch — limits change)

| Service | Free tier (as reported in Oct 2026) | When you outgrow it |
|---|---|---|
| Supabase | 500 MB database, 2 active projects; free projects pause after 1 week of inactivity ([pricing](https://supabase.com/pricing)) | Pro from $25/month (8 GB disk, no pausing). The collector writes every 2 h, which keeps the project active, but a pause takes the site down — move to Pro before relying on it publicly. |
| GitHub Actions | Public repos: free. Private repos on Free plan: ~2,000 Linux minutes/month ([billing docs](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)) | 12 runs/day × ~3–8 min ≈ 1,100–2,900 min/month — may exceed the private-repo allowance; use a public repo, a self-hosted runner (no minutes charged) or a paid plan. |
| Vercel | Hobby is **non-commercial only** ([Hobby plan docs](https://vercel.com/docs/plans/hobby)) | Any ads, sponsorships or paid features require Pro, or self-host (`npm run build && npm start` behind any reverse proxy). |
| Claude API (optional) | Pay per use | Only called for recruitment notices whose text is >300 characters; disable by removing the key. |

**Storage budget:** we store notice metadata plus ≤20 KB of extracted text per document as evidence — not PDFs. At ~1,000 new links/day that is roughly 20 MB/day before cleanup; plan a retention job (delete `discoveries.doc_text` older than 180 days for processed items) once the database passes ~300 MB.

## 8. Backups & recovery

* `backup.yml` takes a daily `pg_dump` (custom format) kept 14 days as a workflow artifact. **Keep the repository private** (the dump contains admin password hashes) or change the upload target.
* Restore into a fresh database:
  ```bash
  pg_restore --no-owner --no-privileges --dbname "$NEW_DATABASE_URL" govjobfinder-YYYYMMDD.dump
  ```
  then point `DATABASE_URL`/`WORKER_DATABASE_URL` at it. Re-running `npm run db:seed` afterwards is safe (it only inserts missing reference rows).
* If the database is lost without a backup: `npm run db:seed` + one pipeline run rebuilds sources and re-collects whatever is still listed on official sites; manual edits and review decisions are lost.

## 9. Security notes

* Admin: bcrypt (cost 12), random 256-bit session tokens stored only as SHA-256, `HttpOnly` + `SameSite=Strict` + `Secure` cookies, 12-hour sessions, database-backed login rate limit (8/email, 20/IP per 15 min), every admin action audited. Roles: *editor* (content + sources) and *admin* (also users).
* Server actions re-check the session and validate input with Zod; Next.js rejects cross-origin action calls.
* All third-party fetching goes through `src/pipeline/net.ts`: http/https only, standard ports, public IPs only (checked at connection time to defeat DNS rebinding), redirects re-validated, size and time limits.
* Rendered links are restricted to http(s); JSON-LD is escaped; CSP blocks third-party scripts and framing.
* Supabase's REST API: RLS is enabled on every table with no policies, so the anon key exposes nothing. The app never uses the anon/service keys.
* Dependencies: run `npm audit` in CI periodically; review before upgrading major versions.

## 10. Source coverage and data-quality tools

| Command | Purpose |
|---|---|
| `npx tsx scripts/coverage-report.ts` | Regenerates `docs/SOURCE_COVERAGE.md` from the live database: working / collected-but-review-only / loads-but-no-links / failing / never checked, per source. |
| `npx tsx scripts/suggest-listings.ts [ids]` | For sources whose page loads but yields no notice links (usually a home page), follows the site's own Recruitment/Careers links and reports which page would yield notices. Read-only; put confirmed URLs in `src/db/seed/listings.ts` and run `npm run db:seed` (moves untouched sources to the listing page). |
| `npm run pipeline -- --reprocess-review` | Re-extract unedited review/archived items with the current rules. |
| `npm run pipeline -- --reprocess-published` | Same, including unedited published items — use after fixing an extraction bug. Items reappear when the run processes them, so run it with a generous `--budget`. |

**Migration log out of sync.** If `drizzle.__drizzle_migrations` is empty but the tables exist and are empty, record the migrations rather than dropping tables: insert one row per migration with `hash` = sha256 of the SQL file and `created_at` = the `when` value from `drizzle/meta/_journal.json` (`readMigrationFiles()` from `drizzle-orm/migrator` returns both).

## 11. Local development

```bash
npm install
npm run db:seed            # embedded PGlite database in ./.data (no accounts needed)
npm run admin:create -- --email you@example.com
npm run dev                # http://localhost:3000
npm run pipeline -- --max 10   # (stop the dev server first — PGlite allows one process)
# With Supabase: put DATABASE_URL (6543) and WORKER_DATABASE_URL (5432) in .env.local;
# the dev server and the pipeline can then run at the same time.
npm test                   # unit + integration tests (in-memory PostgreSQL)
```
For concurrent dev server + pipeline, set `DATABASE_URL` to any PostgreSQL (e.g. a Supabase dev project or local Docker Postgres).
