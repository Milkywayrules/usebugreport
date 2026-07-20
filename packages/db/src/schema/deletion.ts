import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const deletionTombstoneStatusEnum = pgEnum("deletion_tombstone_status", [
  "queued",
  "notifying",
  "external_purge",
  "audit_terminal",
  "postgres_purge",
  "complete",
  "failed",
]);

export const deletionTombstones = pgTable("deletion_tombstones", {
  auditMetadata: jsonb("audit_metadata"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
  id: text("id").primaryKey(),
  lastCompletedStep: text("last_completed_step"),
  organizationId: text("organization_id").notNull(),
  organizationSlug: text("organization_slug").notNull(),
  ownerEmail: text("owner_email").notNull(),
  requestedByUserId: text("requested_by_user_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  status: deletionTombstoneStatusEnum("status").notNull().default("queued"),
});
