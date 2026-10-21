import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  real,
  uniqueIndex,
  index,
  primaryKey,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: ["state", "ut"] }).notNull(),
  /** Free-text summary of typical state-specific recruitments (from the state hub workbook). */
  highlights: text("highlights"),
  /** Reference workbook flagged this entry as least certain ("Check links first"). */
  needsLinkCheck: boolean("needs_link_check").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const sectors = pgTable("sectors", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id").references((): AnyPgColumn => sectors.id, { onDelete: "set null" }),
  /** Lower-case keywords used by the classifier to assign this sector. */
  keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
  sort: integer("sort").notNull().default(0),
});

export const qualifications = pgTable("qualifications", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Ordering from lowest to highest educational level. */
  level: integer("level").notNull().default(0),
  /** Lower-case regex fragments used to detect the qualification in notice text. */
  patterns: text("patterns").array().notNull().default(sql`'{}'::text[]`),
});

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    level: text("level", { enum: ["central", "state", "ut", "psu", "autonomous"] }).notNull(),
    stateId: integer("state_id").references(() => states.id, { onDelete: "set null" }),
    sectorId: integer("sector_id").references(() => sectors.id, { onDelete: "set null" }),
    website: text("website"),
    /** Domains whose links we treat as official for this organisation. */
    officialDomains: text("official_domains").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    /** Which supplied reference file(s) this row came from, for attribution. */
    referenceSource: text("reference_source"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("organizations_state_idx").on(t.stateId), index("organizations_sector_idx").on(t.sectorId)],
);

// ---------------------------------------------------------------------------
// Sources and pipeline
// ---------------------------------------------------------------------------

export type SourceConfig = {
  /** Optional CSS selector scoping link extraction (e.g. "#notices a"). */
  selector?: string;
  /** Regexes (case-insensitive) a link's text or URL must match. Defaults to recruitment vocabulary. */
  include?: string[];
  /** Regexes that drop a link. */
  exclude?: string[];
  /** Fetch linked documents to extract details (default true). */
  fetchDocuments?: boolean;
  /** Maximum links to process per scan (default 40). */
  maxItems?: number;
};

/**
 * no_links: the page loaded but no recruitment links were found on it — extraction did not
 * work (wrong listing URL, JavaScript-only page, selector needed), so it is not a success.
 */
export const SOURCE_CHECK_STATUSES = ["never", "checking", "new_notices", "no_new", "no_links", "partial", "failed"] as const;
export type SourceCheckStatus = (typeof SOURCE_CHECK_STATUSES)[number];

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull().unique(),
    method: text("method", { enum: ["html_links", "rss", "sitemap", "manual"] }).notNull().default("html_links"),
    config: jsonb("config").$type<SourceConfig>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    /** 1 = critical (scanned most often) … 3 = low. */
    priority: integer("priority").notNull().default(2),
    intervalMinutes: integer("interval_minutes").notNull().default(360),
    /** trusted: eligible for auto-publish. review: every item goes to the review queue. */
    trust: text("trust", { enum: ["trusted", "review"] }).notNull().default("review"),
    allowedDomains: text("allowed_domains").array().notNull().default(sql`'{}'::text[]`),
    // Health
    urlStatus: text("url_status", { enum: ["unchecked", "ok", "redirect", "broken", "blocked", "timeout"] })
      .notNull()
      .default("unchecked"),
    urlCheckedAt: ts("url_checked_at"),
    finalUrl: text("final_url"),
    lastCheckedAt: ts("last_checked_at"),
    lastSuccessAt: ts("last_success_at"),
    lastDiscoveryAt: ts("last_discovery_at"),
    /**
     * Outcome of the most recent check. "partial": the listing loaded but some of its
     * documents could not be processed. Disabled sources are shown from `enabled`.
     */
    lastCheckStatus: text("last_check_status", { enum: SOURCE_CHECK_STATUSES }).notNull().default("never"),
    /** Links found on the listing / new links, in the most recent successful check. */
    lastCheckFound: integer("last_check_found"),
    lastCheckNew: integer("last_check_new"),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    nextCheckAt: ts("next_check_at"),
    etag: text("etag"),
    lastModified: text("last_modified"),
    contentHash: text("content_hash"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sources_next_check_idx").on(t.enabled, t.nextCheckAt), index("sources_org_idx").on(t.organizationId)],
);

/** admission: admissions, entrance exams and counselling for courses (not jobs). */
export const NOTICE_KINDS = ["recruitment", "admit_card", "result", "answer_key", "syllabus", "exam_date", "admission", "other"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const NOTICE_STATUSES = [
  /** Being written by an editor in the content manager; never public, not in the review queue. */
  "draft",
  "discovered",
  "extracted",
  "needs_review",
  "published",
  "closed",
  "cancelled",
  "withdrawn",
  "rejected",
  "archived",
] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export const discoveries = pgTable(
  "discoveries",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    linkText: text("link_text").notNull(),
    /** sha256 of normalised URL — the duplicate-control key. */
    fingerprint: text("fingerprint").notNull(),
    kindGuess: text("kind_guess", { enum: NOTICE_KINDS }),
    state: text("state", { enum: ["new", "processed", "ignored", "failed"] }).notNull().default("new"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at"),
    lastError: text("last_error"),
    docContentType: text("doc_content_type"),
    docHash: text("doc_hash"),
    /** First ~20k characters of extracted document text, kept as source evidence. */
    docText: text("doc_text"),
    noticeId: integer("notice_id").references((): AnyPgColumn => notices.id, { onDelete: "set null" }),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("discoveries_fingerprint_uq").on(t.fingerprint), index("discoveries_state_idx").on(t.state, t.nextAttemptAt)],
);

export type ImportantDate = { label: string; date?: string | null; text?: string | null };
export type NoticeLink = { label: string; url: string };
export type FieldSource = "notice" | "ai" | "admin" | "source_page";

export const notices = pgTable(
  "notices",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: NOTICE_KINDS }).notNull().default("recruitment"),
    status: text("status", { enum: NOTICE_STATUSES }).notNull().default("discovered"),
    title: text("title").notNull(),
    summary: text("summary"),
    organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
    stateId: integer("state_id").references(() => states.id, { onDelete: "set null" }),
    sectorId: integer("sector_id").references(() => sectors.id, { onDelete: "set null" }),
    isCentral: boolean("is_central").notNull().default(false),
    parentId: integer("parent_id").references((): AnyPgColumn => notices.id, { onDelete: "set null" }),

    advtNo: text("advt_no"),
    totalPosts: integer("total_posts"),
    postNames: text("post_names"),
    location: text("location"),
    qualificationText: text("qualification_text"),
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    ageText: text("age_text"),
    feeText: text("fee_text"),
    salaryText: text("salary_text"),
    jobType: text("job_type", { enum: ["permanent", "contract", "apprentice", "deputation", "unknown"] })
      .notNull()
      .default("unknown"),
    experienceText: text("experience_text"),
    selectionText: text("selection_text"),
    howToApply: text("how_to_apply"),
    documentsText: text("documents_text"),
    importantDates: jsonb("important_dates").$type<ImportantDate[]>().notNull().default([]),

    noticeDate: date("notice_date", { mode: "string" }),
    applyStart: date("apply_start", { mode: "string" }),
    applyEnd: date("apply_end", { mode: "string" }),
    examDate: date("exam_date", { mode: "string" }),

    notificationUrl: text("notification_url"),
    applyUrl: text("apply_url"),
    sourcePageUrl: text("source_page_url"),
    links: jsonb("links").$type<NoticeLink[]>().notNull().default([]),

    /** Where each populated field came from. Fields absent here were not established. */
    fieldSources: jsonb("field_sources").$type<Record<string, FieldSource>>().notNull().default({}),
    extractionConfidence: real("extraction_confidence"),
    verification: text("verification", { enum: ["auto", "reviewed", "manual"] }).notNull().default("auto"),
    reviewReasons: text("review_reasons").array().notNull().default(sql`'{}'::text[]`),
    dedupeKey: text("dedupe_key"),
    docHash: text("doc_hash"),
    /** Shown first in listings and on the homepage boards (set in the content manager). */
    pinned: boolean("pinned").notNull().default(false),
    /** Extra search terms set by editors (comma separated); matched by public search. */
    keywords: text("keywords"),
    /** Official PDF uploaded by an editor; served from /files/<id> once the notice is public. */
    attachmentId: integer("attachment_id").references((): AnyPgColumn => uploads.id, { onDelete: "set null" }),

    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastCheckedAt: ts("last_checked_at"),
    publishedAt: ts("published_at"),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(advt_no, '') || ' ' || coalesce(post_names, '')), 'B') || setweight(to_tsvector('english', coalesce(qualification_text, '') || ' ' || coalesce(summary, '')), 'C')`,
    ),
  },
  (t) => [
    uniqueIndex("notices_dedupe_uq").on(t.dedupeKey),
    index("notices_public_idx").on(t.status, t.kind, t.publishedAt),
    index("notices_apply_end_idx").on(t.applyEnd),
    index("notices_state_idx").on(t.stateId),
    index("notices_sector_idx").on(t.sectorId),
    index("notices_org_idx").on(t.organizationId),
    index("notices_parent_idx").on(t.parentId),
    index("notices_search_idx").using("gin", t.search),
  ],
);

/**
 * Files uploaded by editors (official notification PDFs). Stored in the database by default —
 * the deployment (Vercel + Supabase Postgres) has no writable disk or configured object store —
 * or in Supabase Storage when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (`data` is then null).
 */
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  storage: text("storage", { enum: ["database", "supabase"] }).notNull().default("database"),
  storageKey: text("storage_key"),
  data: bytea("data"),
  /** Text extracted from the PDF when uploaded (first ~20k characters), shown to the editor. */
  extractedText: text("extracted_text"),
  uploadedBy: integer("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Editable website settings (popular searches, announcement banner). Values are JSON. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const noticeQualifications = pgTable(
  "notice_qualifications",
  {
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    qualificationId: integer("qualification_id")
      .notNull()
      .references(() => qualifications.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.noticeId, t.qualificationId] }), index("nq_qual_idx").on(t.qualificationId)],
);

export const noticeRevisions = pgTable(
  "notice_revisions",
  {
    id: serial("id").primaryKey(),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    changeType: text("change_type").notNull(),
    /** { field: [before, after] } */
    diff: jsonb("diff").$type<Record<string, [unknown, unknown]>>().notNull().default({}),
    actor: text("actor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notice_revisions_notice_idx").on(t.noticeId, t.createdAt)],
);

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: serial("id").primaryKey(),
    trigger: text("trigger", { enum: ["schedule", "manual", "admin", "source"] }).notNull(),
    status: text("status", { enum: ["running", "success", "partial", "failed"] }).notNull().default("running"),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    error: text("error"),
    startedAt: ts("started_at").notNull().defaultNow(),
    heartbeatAt: ts("heartbeat_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("pipeline_runs_started_idx").on(t.startedAt)],
);

export const pipelineEvents = pgTable(
  "pipeline_events",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id").references(() => pipelineRuns.id, { onDelete: "cascade" }),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "cascade" }),
    discoveryId: integer("discovery_id").references(() => discoveries.id, { onDelete: "cascade" }),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
    message: text("message").notNull(),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("pipeline_events_run_idx").on(t.runId), index("pipeline_events_source_idx").on(t.sourceId, t.createdAt)],
);

/** Full-run requests from the admin UI, picked up by the next worker run. */
export const pipelineRequests = pgTable("pipeline_requests", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => sources.id, { onDelete: "cascade" }),
  requestedBy: integer("requested_by"),
  createdAt: createdAt(),
  pickedAt: ts("picked_at"),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    /** sha256 of the session token; the raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Exam directory (from "Top 50 Exams Technical Sector")
// ---------------------------------------------------------------------------

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  group: text("group").notNull(),
  rank: integer("rank"),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  recruitingBody: text("recruiting_body"),
  officialUrl: text("official_url"),
  /** Historical notification window from the reference file — indicative only. */
  typicalWindow: text("typical_window"),
  focusAreas: text("focus_areas"),
  /** Unverified figures from the reference file; never shown as fact. */
  indicativeSalary: text("indicative_salary"),
  difficulty: text("difficulty"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});
