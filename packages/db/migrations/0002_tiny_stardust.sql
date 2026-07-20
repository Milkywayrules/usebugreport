CREATE TYPE "public"."billing_tier" AS ENUM('free', 'pro', 'studio', 'agency');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_tier" "billing_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "retention_days_replay" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "retention_days_screenshot" integer;