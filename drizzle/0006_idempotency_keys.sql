CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Same lockdown as 0001: never readable through the public REST API.
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
