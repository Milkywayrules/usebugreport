CREATE TABLE "ingest_keys" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"project_id" text NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_linear_team_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"pinned_order" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pinned_workspace_ids" text[] DEFAULT '{}' NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_keys" ADD CONSTRAINT "ingest_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_keys_project_id_idx" ON "ingest_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_keys_active_project_uidx" ON "ingest_keys" USING btree ("project_id") WHERE "ingest_keys"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_uidx" ON "projects" USING btree ("organization_id","slug");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_org_project_created_idx" ON "reports" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST);