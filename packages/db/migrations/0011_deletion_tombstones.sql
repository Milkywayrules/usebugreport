CREATE TYPE "public"."deletion_tombstone_status" AS ENUM('queued', 'notifying', 'external_purge', 'audit_terminal', 'postgres_purge', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "deletion_tombstones" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"organization_slug" text NOT NULL,
	"owner_email" text NOT NULL,
	"status" "deletion_tombstone_status" DEFAULT 'queued' NOT NULL,
	"last_completed_step" text,
	"requested_by_user_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text,
	"audit_metadata" jsonb
);
