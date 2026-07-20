CREATE TYPE "public"."comment_author_type" AS ENUM('user', 'api_key');--> statement-breakpoint
CREATE TABLE "report_comments" (
	"author_api_key_id" text,
	"author_display_name" text NOT NULL,
	"author_type" "comment_author_type" NOT NULL,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text,
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"report_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_comments_report_created_idx" ON "report_comments" USING btree ("report_id","created_at");
