import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const workspaceApiKeys = pgTable(
  "workspace_api_keys",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("workspace_api_keys_org_id_idx").on(table.organizationId),
    index("workspace_api_keys_active_org_idx")
      .on(table.organizationId)
      .where(sql`${table.revokedAt} is null`),
  ]
);

export const workspaceApiKeysRelations = relations(
  workspaceApiKeys,
  ({ one }) => ({
    organization: one(organization, {
      fields: [workspaceApiKeys.organizationId],
      references: [organization.id],
    }),
  })
);
