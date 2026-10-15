# Reference data: how the supplied files were used

Three reference files were supplied (plus a design reference, `demo-site.html`). All rows were inspected in full and normalised into seed data under `src/db/seed/`. Seeding is idempotent and never overwrites edits made in the admin dashboard.

| File | Sheets / sections | Became |
|---|---|---|
| `State_Wise_Govt_Jobs_Hub.xlsx` (4 identical copies) | *State-Wise Hub* (36 rows), *All Links* (85 bodies with URL, category, "Verified?"), *Notes* | 36 `states` (28 states + 8 UTs, highlights, "check links first" flag) · 85 state/UT `organizations` · 84 `sources` (SSO Rajasthan kept as a reference-only login portal) — `src/db/seed/states.ts` |
| `Sector-wise-job.docx` | 12 sector sections, ~60 links | 18 `sectors` (split where candidates search separately: IT vs engineering, judiciary vs postal, scientific research, apprenticeships, state general) · central / PSU / autonomous `organizations` and their `sources` — `src/db/seed/taxonomy.ts`, `central.ts` |
| `Top 50 Exams Technical Sector.xlsx` | *Sheet1* (50 rows); *Sheet2* is a formatted duplicate | 50 `exams` rows for the public technical exam directory (`/exams`) and extra organisations (SEBI, NTRO, MeitY, CSIR, AAI, NMDC, BPCL, NPCIL, CVC, IB/MHA, CBI, ED) — `src/db/seed/exams.ts` |
| Research additions | — | Employment News, Assam Rifles, NTA (+UGC NET), NIELIT, ICAR, EPFO, FCI, NATS, BSNL — gaps in central recruiter coverage |

Totals after seeding: **36 states/UTs, 18 sectors, 15 qualifications, 154 organisations, 159 sources, 50 exams.**

## Corrections made (and why)

| Item | Reference file said | Changed to | Evidence |
|---|---|---|---|
| Meghalaya PSC | `mpsc.nic.in` | `mpsc.meghalaya.gov.in` | Old domain did not resolve (2026-10-15); commission's current pages are on the new domain |
| Tripura TRB | `trbt.tripura.gov.in` | `trb.tripura.gov.in` | Old host did not resolve; official notices reference `trb.tripura.gov.in` |
| HP recruitment board | `hpsssb.hp.gov.in` (HPSSSB) | `hprca.hp.gov.in` (HPRCA) | HPSSSB was dissolved and replaced by HPRCA |
| SSB (paramilitary) | `ssbrectt.gov.in` | `ssb.gov.in` (old kept as official domain) | Recruitment host did not resolve on 2026-10-15 |
| SBI careers | `sbi.co.in/web/careers` | `sbi.bank.in/web/careers` | Old URL redirects there |
| KVS | `kvsangathan.nic.in` | `kvs.gov.in` | Old URL redirects there |
| EPFO | `epfindia.gov.in` | `epfo.gov.in` | Redirect |
| SSC | `ssc.nic.in` (Top-50 file) | `ssc.gov.in` | Sector file already used the current domain |
| DRDO | `drdo.gov.in` | `drdo.gov.in/drdo/en` | Root redirected to the Hindi (IDN) site |
| Top-50 #36 ED | link and notification-month columns swapped | fixed | Data entry error |
| Top-50 #23 DFO | recruiter "NTRO" | Cabinet Secretariat (no URL) | DFO posts are not NTRO recruitments |
| Top-50 #22 IRSSE, #48 IRPS | listed as separate services | "Indian Railway Management Service (formerly …)" | Merged into IRMS |
| Top-50 #34 BBNL | separate recruiter | BSNL; exam marked inactive | BBNL merged into BSNL |
| Top-50 #38 "IT Assessment" | categorised as IT | note added: Income Tax | Category error |
| Top-50 #50 "State-Level IT Officer/MNC" | includes "MNC" | "State-Level IT Officer" | MNCs are not government employers |
| Top-50 salary & difficulty | presented as figures | stored, **not displayed** | No source given; would be presented as fact |
| AP/Arunachal "APPSC" | same acronym | distinct names and slugs | Avoid confusing two commissions |
| SEBA (Assam) | listed as recruiter | kept, with note | It is an exam board that conducts ADRE |

Kept but flagged: `gramawardsachivalayam.ap.gov.in` (did not resolve; left for admin follow-up), `npsc.co.in` and `tgprb.in` (official bodies on non-`.gov.in` domains — treated as the organisation's own domain), Employment News (site root returned 404 to all clients on 2026-10-15).

## Link validation (live, from India, 2026-10-15)

`npm run sources:validate` checks every source and stores the result (`sources.url_status`, visible in */admin/sources*).

* **First pass (as supplied):** 104 OK, 5 redirect, 39 broken, 11 timeout of 159.
* Root causes of "broken": missing intermediate TLS certificates (≈15 sites), legacy TLS renegotiation (≈7), DNS failures (wrong hostnames above), WAF/bot protection returning 403 (UPSC, MHA, Supreme Court, MeitY), expired certificates (TGPSC, CISF), timeouts.
* **Fixes in the fetcher** (verification never disabled): AIA chasing for missing intermediates, `SSL_OP_LEGACY_SERVER_CONNECT` for legacy servers. Re-tested sites (BPSC, APSC, JKPSC, NIELIT, PGIMER, BEL, HPPSC, RSSB…) now load.
* **Second pass (after fetcher fixes and URL corrections):** 131 OK, 1 redirect, 17 broken, 10 timeout of 159.
* Sites behind bot protection are **not** circumvented. Their notices reach the site through Employment News or manual entry.

## How sources become notices

Each source row stores: organisation, URL, method (`html_links`, `rss`, `sitemap`, `manual`), priority (scan interval 2 h / 6 h / 12 h), trust (`trusted` may auto-publish, `review` never does), allowed official domains, and optional CSS selector / include / exclude regexes / max links. Defaults: commission/board/police/teaching/health bodies on `.gov.in`/`.nic.in` → *trusted*; general government portals → *review*, priority 3.

Recommended next steps for coverage: for high-volume sources, set a CSS selector pointing at the "What's New / Recruitment" block (cuts noise), and add each state's police and health recruitment boards that are not in the reference files.
