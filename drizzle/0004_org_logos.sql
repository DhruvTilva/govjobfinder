ALTER TABLE "organizations" ADD COLUMN "logo_id" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_source" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_id_uploads_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;