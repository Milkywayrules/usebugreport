import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const projects = pgTable(
  "projects",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    defaultLinearTeamId: text("default_linear_team_id"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
  },
  (table) => [
    uniqueIndex("projects_org_slug_uidx").on(table.organizationId, table.slug),
  ]
);

export const ingestKeys = pgTable(
  "ingest_keys",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("ingest_keys_project_id_idx").on(table.projectId),
    uniqueIndex("ingest_keys_active_project_uidx")
      .on(table.projectId)
      .where(sql`${table.revokedAt} is null`),
  ]
);

export const userPreferences = pgTable("user_preferences", {
  pinnedOrder: jsonb("pinned_order").notNull().default({}),
  pinnedWorkspaceIds: text("pinned_workspace_ids")
    .array()
    .notNull()
    .default([]),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const projectsRelations = relations(projects, ({ many, one }) => ({
  ingestKeys: many(ingestKeys),
  organization: one(organization, {
    fields: [projects.organizationId],
    references: [organization.id],
  }),
}));

export const ingestKeysRelations = relations(ingestKeys, ({ one }) => ({
  project: one(projects, {
    fields: [ingestKeys.projectId],
    references: [projects.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [userPreferences.userId],
      references: [user.id],
    }),
  })
);
