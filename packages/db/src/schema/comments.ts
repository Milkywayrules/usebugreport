import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { reports } from "./ingest";

export const commentAuthorTypeEnum = pgEnum("comment_author_type", [
  "user",
  "api_key",
]);

export const reportComments = pgTable(
  "report_comments",
  {
    authorApiKeyId: text("author_api_key_id"),
    authorDisplayName: text("author_display_name").notNull(),
    authorType: commentAuthorTypeEnum("author_type").notNull(),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dedupeKey: text("dedupe_key"),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("report_comments_report_created_idx").on(
      table.reportId,
      table.createdAt
    ),
  ]
);

export const reportCommentsRelations = relations(reportComments, ({ one }) => ({
  authorUser: one(user, {
    fields: [reportComments.authorUserId],
    references: [user.id],
  }),
  report: one(reports, {
    fields: [reportComments.reportId],
    references: [reports.id],
  }),
}));
