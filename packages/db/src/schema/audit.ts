import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  eventType: text("event_type").notNull(),
  id: text("id").primaryKey(),
  metadata: jsonb("metadata").notNull().default({}),
  organizationId: text("organization_id"),
  tombstoneId: text("tombstone_id"),
});
