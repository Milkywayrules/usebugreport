import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const webhookEndpoints = pgTable("webhook_endpoints", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  events: text("events").array().notNull(),
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret").notNull(),
  url: text("url").notNull(),
});

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  organization: one(organization, {
    fields: [webhookEndpoints.organizationId],
    references: [organization.id],
  }),
}));
