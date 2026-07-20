CREATE TABLE "workspace_api_keys" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"scopes" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_api_keys" ADD CONSTRAINT "workspace_api_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_api_keys_org_id_idx" ON "workspace_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_api_keys_active_org_idx" ON "workspace_api_keys" USING btree ("organization_id") WHERE "workspace_api_keys"."revoked_at" is null;
