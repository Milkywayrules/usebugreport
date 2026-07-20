import { createDbClient, schema } from "@usebugreport/db";
import { makeSignature } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";

const {
  member,
  organization,
  session: sessionTable,
  user: userTable,
  userPreferences,
} = schema;

const testEnvDefaults = {
  API_URL: process.env.API_URL ?? "http://127.0.0.1:3101",
  APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3100",
  BETTER_AUTH_SECRET: "test-better-auth-secret-min-32-characters",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://usebugreport:usebugreport@localhost:5432/usebugreport",
  ENCRYPTION_KEY: "test-encryption-key-32-characters-min",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  LINEAR_CLIENT_ID: "test-linear-client-id",
  LINEAR_CLIENT_SECRET: "test-linear-client-secret",
  R2_ACCESS_KEY_ID: "test",
  R2_ACCOUNT_ID: "test",
  R2_BUCKET: "test",
  R2_SECRET_ACCESS_KEY: "test",
  REDIS_URL: "redis://localhost:6379",
} as const;

const SESSION_COOKIE_NAME = "better-auth.session_token";

function applyTestEnv(): void {
  if (process.env.RESEND_API_KEY === "") {
    delete process.env.RESEND_API_KEY;
  }

  for (const [key, value] of Object.entries(testEnvDefaults)) {
    process.env[key] ??= value;
  }
}

export interface SessionFixture {
  cookieHeader: string;
  cookieName: string;
  cookieValue: string;
  orgSlug?: string;
  token: string;
  userId: string;
}

async function truncateAuthTables(db: ReturnType<typeof createDbClient>) {
  await db.execute(sql`
    truncate table
      workspace_api_keys,
      project_members,
      ingest_keys,
      projects,
      user_preferences,
      reports,
      report_blobs,
      workspace_usage_monthly,
      apikey,
      invitation,
      member,
      organization,
      verification,
      account,
      session,
      "user"
    restart identity cascade
  `);
}

async function signSessionCookie(token: string): Promise<string> {
  applyTestEnv();
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    testEnvDefaults.BETTER_AUTH_SECRET;
  return `${token}.${await makeSignature(token, secret)}`;
}

export interface SessionOrganization {
  billingTier?: string;
  id: string;
  name: string;
  slug: string;
}

export async function createSessionFixture(options?: {
  activeOrganizationId?: string;
  orgSlug?: string;
  organizations?: SessionOrganization[];
  pinnedWorkspaceIds?: string[];
  token?: string;
  userId?: string;
  withOrganization?: boolean;
}): Promise<SessionFixture> {
  applyTestEnv();

  const db = createDbClient(process.env.DATABASE_URL!);
  await truncateAuthTables(db);

  const userId = options?.userId ?? "user_e2e_gate";
  const sessionId = `session_${userId}`;
  const token = options?.token ?? "session-token-e2e-gate-1234567890";

  await db.insert(userTable).values({
    createdAt: new Date(),
    email: "e2e-gate@example.com",
    emailVerified: true,
    id: userId,
    name: "E2E Gate User",
    updatedAt: new Date(),
  });

  await db.insert(sessionTable).values({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    id: sessionId,
    token,
    updatedAt: new Date(),
    userId,
  });

  let orgSlug: string | undefined;
  let activeOrganizationId = options?.activeOrganizationId;

  if (options?.organizations?.length) {
    for (const org of options.organizations) {
      await db.insert(organization).values({
        billingTier: org.billingTier ?? "pro",
        createdAt: new Date(),
        id: org.id,
        name: org.name,
        slug: org.slug,
      });

      await db.insert(member).values({
        createdAt: new Date(),
        id: `member_${org.id}`,
        organizationId: org.id,
        role: "owner",
        userId,
      });
    }

    activeOrganizationId ??= options.organizations[0]?.id;
    orgSlug = options.organizations.find((org) => org.id === activeOrganizationId)?.slug;

    if (options.pinnedWorkspaceIds?.length) {
      await db.insert(userPreferences).values({
        pinnedWorkspaceIds: options.pinnedWorkspaceIds,
        userId,
      });
    }
  } else if (options?.withOrganization) {
    activeOrganizationId = "org_e2e_gate";
    orgSlug = options.orgSlug ?? "acme";
    await db.insert(organization).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_e2e_gate",
      name: "Acme",
      slug: orgSlug,
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_e2e_gate",
      organizationId: "org_e2e_gate",
      role: "owner",
      userId,
    });
  }

  if (activeOrganizationId) {
    await db
      .update(sessionTable)
      .set({ activeOrganizationId })
      .where(eq(sessionTable.id, sessionId));
  }

  const cookieValue = await signSessionCookie(token);

  return {
    cookieHeader: `${SESSION_COOKIE_NAME}=${cookieValue}`,
    cookieName: SESSION_COOKIE_NAME,
    cookieValue,
    orgSlug,
    token,
    userId,
  };
}

export async function seedDatabaseForGateTests(): Promise<void> {
  applyTestEnv();
  const db = createDbClient(process.env.DATABASE_URL!);
  await truncateAuthTables(db);
}
