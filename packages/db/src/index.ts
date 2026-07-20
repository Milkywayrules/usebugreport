import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  account,
  accountRelations,
  apikey,
  ingestKeys,
  ingestKeysRelations,
  invitation,
  invitationRelations,
  member,
  memberRelations,
  organization,
  organizationRelations,
  projects,
  projectsRelations,
  reportBlobs,
  reportBlobsRelations,
  reports,
  reportsRelations,
  session,
  sessionRelations,
  user,
  userPreferences,
  userPreferencesRelations,
  userRelations,
  verification,
  workspaceUsageMonthly,
  workspaceUsageMonthlyRelations,
} from "./schema/index";

export const schema = {
  account,
  accountRelations,
  apikey,
  ingestKeys,
  ingestKeysRelations,
  invitation,
  invitationRelations,
  member,
  memberRelations,
  organization,
  organizationRelations,
  projects,
  projectsRelations,
  reportBlobs,
  reportBlobsRelations,
  reports,
  reportsRelations,
  session,
  sessionRelations,
  user,
  userPreferences,
  userPreferencesRelations,
  userRelations,
  verification,
  workspaceUsageMonthly,
  workspaceUsageMonthlyRelations,
};

export type DbClient = PostgresJsDatabase<typeof schema>;

export function createDbClient(databaseUrl: string): DbClient {
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

export * from "./schema/index";
