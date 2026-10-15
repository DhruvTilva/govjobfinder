CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"url" text NOT NULL,
	"link_text" text NOT NULL,
	"fingerprint" text NOT NULL,
	"kind_guess" text,
	"state" text DEFAULT 'new' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"doc_content_type" text,
	"doc_hash" text,
	"doc_text" text,
	"notice_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"rank" integer,
	"organization_id" integer,
	"recruiting_body" text,
	"official_url" text,
	"typical_window" text,
	"focus_areas" text,
	"indicative_salary" text,
	"difficulty" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notice_qualifications" (
	"notice_id" integer NOT NULL,
	"qualification_id" integer NOT NULL,
	CONSTRAINT "notice_qualifications_notice_id_qualification_id_pk" PRIMARY KEY("notice_id","qualification_id")
);
--> statement-breakpoint
CREATE TABLE "notice_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"notice_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'recruitment' NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"organization_id" integer,
	"source_id" integer,
	"state_id" integer,
	"sector_id" integer,
	"is_central" boolean DEFAULT false NOT NULL,
	"parent_id" integer,
	"advt_no" text,
	"total_posts" integer,
	"post_names" text,
	"location" text,
	"qualification_text" text,
	"age_min" integer,
	"age_max" integer,
	"age_text" text,
	"fee_text" text,
	"salary_text" text,
	"job_type" text DEFAULT 'unknown' NOT NULL,
	"experience_text" text,
	"selection_text" text,
	"how_to_apply" text,
	"documents_text" text,
	"important_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notice_date" date,
	"apply_start" date,
	"apply_end" date,
	"exam_date" date,
	"notification_url" text,
	"apply_url" text,
	"source_page_url" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"field_sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extraction_confidence" real,
	"verification" text DEFAULT 'auto' NOT NULL,
	"review_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"dedupe_key" text,
	"doc_hash" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(advt_no, '') || ' ' || coalesce(post_names, '')), 'B') || setweight(to_tsvector('english', coalesce(qualification_text, '') || ' ' || coalesce(summary, '')), 'C')) STORED,
	CONSTRAINT "notices_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"level" text NOT NULL,
	"state_id" integer,
	"sector_id" integer,
	"website" text,
	"official_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"reference_source" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pipeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"source_id" integer,
	"discovery_id" integer,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer,
	"requested_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"picked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"source_id" integer,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"patterns" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "qualifications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" integer,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sectors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"method" text DEFAULT 'html_links' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"interval_minutes" integer DEFAULT 360 NOT NULL,
	"trust" text DEFAULT 'review' NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"url_status" text DEFAULT 'unchecked' NOT NULL,
	"url_checked_at" timestamp with time zone,
	"final_url" text,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_discovery_at" timestamp with time zone,
	"last_status_code" integer,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"next_check_at" timestamp with time zone,
	"etag" text,
	"last_modified" text,
	"content_hash" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"highlights" text,
	"needs_link_check" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "states_code_unique" UNIQUE("code"),
	CONSTRAINT "states_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_qualifications" ADD CONSTRAINT "notice_qualifications_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_qualifications" ADD CONSTRAINT "notice_qualifications_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_revisions" ADD CONSTRAINT "notice_revisions_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_parent_id_notices_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD CONSTRAINT "pipeline_requests_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_parent_id_sectors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discoveries_fingerprint_uq" ON "discoveries" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "discoveries_state_idx" ON "discoveries" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "nq_qual_idx" ON "notice_qualifications" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "notice_revisions_notice_idx" ON "notice_revisions" USING btree ("notice_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notices_dedupe_uq" ON "notices" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notices_public_idx" ON "notices" USING btree ("status","kind","published_at");--> statement-breakpoint
CREATE INDEX "notices_apply_end_idx" ON "notices" USING btree ("apply_end");--> statement-breakpoint
CREATE INDEX "notices_state_idx" ON "notices" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "notices_sector_idx" ON "notices" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "notices_org_idx" ON "notices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notices_parent_idx" ON "notices" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notices_search_idx" ON "notices" USING gin ("search");--> statement-breakpoint
CREATE INDEX "organizations_state_idx" ON "organizations" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "organizations_sector_idx" ON "organizations" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "pipeline_events_run_idx" ON "pipeline_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "pipeline_events_source_idx" ON "pipeline_events" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "pipeline_runs_started_idx" ON "pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sources_next_check_idx" ON "sources" USING btree ("enabled","next_check_at");--> statement-breakpoint
CREATE INDEX "sources_org_idx" ON "sources" USING btree ("organization_id");