import { relations, sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { projects } from "./projects";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
  "duplicate",
]);

export const ingestStatusEnum = pgEnum("ingest_status", [
  "pending",
  "processing",
  "complete",
  "failed",
]);

export const reportBlobTypeEnum = pgEnum("report_blob_type", [
  "replay",
  "screenshot",
  "console",
  "network",
  "meta",
]);

export const reports = pgTable(
  "reports",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    description: text("description"),
    environment: jsonb("environment").notNull().default({}),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    ingestStatus: ingestStatusEnum("ingest_status")
      .default("pending")
      .notNull(),
    linearIssueId: text("linear_issue_id"),
    linearIssueUrl: text("linear_issue_url"),
    metadataRetentionUntil: timestamp("metadata_retention_until", {
      withTimezone: true,
    }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reporterLabel: text("reporter_label"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`(
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary_text, '')), 'C')
      )`
    ),
    status: reportStatusEnum("status").default("open").notNull(),
    summary: jsonb("summary").notNull().default({}),
    summaryText: text("summary_text"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reports_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt.desc()
    ),
    index("reports_org_project_created_idx").on(
      table.organizationId,
      table.projectId,
      table.createdAt.desc()
    ),
    uniqueIndex("reports_project_idempotency_uidx")
      .on(table.projectId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("reports_search_vector_idx").using("gin", table.searchVector),
  ]
);

export const reportBlobs = pgTable(
  "report_blobs",
  {
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    type: reportBlobTypeEnum("type").notNull(),
  },
  (table) => [index("report_blobs_report_id_idx").on(table.reportId)]
);

export const workspaceUsageMonthly = pgTable(
  "workspace_usage_monthly",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    reportCount: integer("report_count").default(0).notNull(),
    yearMonth: text("year_month").notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.yearMonth] })]
);

export const reportsRelations = relations(reports, ({ many, one }) => ({
  blobs: many(reportBlobs),
  organization: one(organization, {
    fields: [reports.organizationId],
    references: [organization.id],
  }),
}));

export const reportBlobsRelations = relations(reportBlobs, ({ one }) => ({
  report: one(reports, {
    fields: [reportBlobs.reportId],
    references: [reports.id],
  }),
}));

export const workspaceUsageMonthlyRelations = relations(
  workspaceUsageMonthly,
  ({ one }) => ({
    organization: one(organization, {
      fields: [workspaceUsageMonthly.organizationId],
      references: [organization.id],
    }),
  })
);
