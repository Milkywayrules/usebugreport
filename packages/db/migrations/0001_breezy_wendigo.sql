CREATE TYPE "public"."ingest_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_blob_type" AS ENUM('replay', 'screenshot', 'console', 'network', 'meta');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'in_progress', 'resolved', 'closed', 'duplicate');--> statement-breakpoint
CREATE TABLE "report_blobs" (
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"report_id" text NOT NULL,
	"seq" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"type" "report_blob_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"environment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text,
	"ingest_status" "ingest_status" DEFAULT 'pending' NOT NULL,
	"linear_issue_id" text,
	"linear_issue_url" text,
	"metadata_retention_until" timestamp with time zone,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"reporter_label" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary_text, '')), 'C')
      )) STORED,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary_text" text,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_usage_monthly" (
	"organization_id" text NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"year_month" text NOT NULL,
	CONSTRAINT "workspace_usage_monthly_organization_id_year_month_pk" PRIMARY KEY("organization_id","year_month")
);
--> statement-breakpoint
ALTER TABLE "report_blobs" ADD CONSTRAINT "report_blobs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage_monthly" ADD CONSTRAINT "workspace_usage_monthly_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_blobs_report_id_idx" ON "report_blobs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "reports_org_status_created_idx" ON "reports" USING btree ("organization_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "reports_project_idempotency_uidx" ON "reports" USING btree ("project_id","idempotency_key") WHERE "reports"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "reports_search_vector_idx" ON "reports" USING gin ("search_vector");