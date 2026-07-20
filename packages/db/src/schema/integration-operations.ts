import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { reports } from "./ingest";

export const integrationOperationStatusEnum = pgEnum(
  "integration_operation_status",
  ["pending", "succeeded", "failed"]
);

export const integrationOperations = pgTable(
  "integration_operations",
  {
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    error: text("error"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    status: integrationOperationStatusEnum("status").notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_operations_report_action_uidx").on(
      table.reportId,
      table.action
    ),
  ]
);

export const integrationOperationsRelations = relations(
  integrationOperations,
  ({ one }) => ({
    organization: one(organization, {
      fields: [integrationOperations.organizationId],
      references: [organization.id],
    }),
    report: one(reports, {
      fields: [integrationOperations.reportId],
      references: [reports.id],
    }),
  })
);
