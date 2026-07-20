ALTER TYPE "public"."integration_type" ADD VALUE 'github';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_github_repo" text;
