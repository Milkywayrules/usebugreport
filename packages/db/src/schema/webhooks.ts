import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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

export const webhookDeliveries = pgTable("webhook_deliveries", {
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  endpointId: text("endpoint_id")
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  id: text("id").primaryKey(),
  lastResponseCode: integer("last_response_code"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(),
});

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  deliveries: many(webhookDeliveries),
  organization: one(organization, {
    fields: [webhookEndpoints.organizationId],
    references: [organization.id],
  }),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));
