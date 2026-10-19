ALTER TABLE "sources" ADD COLUMN "last_check_status" text DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_check_found" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_check_new" integer;--> statement-breakpoint
-- Backfill from existing health columns so already-checked sources don't show as "never".
UPDATE "sources" SET "last_check_status" = CASE
  WHEN "last_checked_at" IS NULL THEN 'never'
  WHEN "consecutive_failures" > 0 THEN 'failed'
  WHEN "last_discovery_at" IS NOT NULL AND "last_discovery_at" >= "last_checked_at" THEN 'new_notices'
  ELSE 'no_new'
END;
