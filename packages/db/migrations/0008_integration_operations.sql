CREATE TYPE "public"."integration_operation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "integration_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"action" text NOT NULL,
	"status" "integration_operation_status" DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"external_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_operations_report_action_uidx" ON "integration_operations" USING btree ("report_id","action");
