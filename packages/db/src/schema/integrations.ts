import { relations, sql } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const integrationTypeEnum = pgEnum("integration_type", ["linear", "github"]);

export const integrations = pgTable(
  "integrations",
  {
    config: jsonb("config").notNull().default({}),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: text("id").primaryKey(),
    oauthTokensEncrypted: text("oauth_tokens_encrypted").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    type: integrationTypeEnum("type").notNull(),
  },
  (table) => [
    uniqueIndex("integrations_active_org_type_uidx")
      .on(table.organizationId, table.type)
      .where(sql`${table.revokedAt} is null`),
  ]
);

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organization, {
    fields: [integrations.organizationId],
    references: [organization.id],
  }),
}));
