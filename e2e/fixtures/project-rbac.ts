import { createDbClient, schema } from "@usebugreport/db";
import { makeSignature } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import type { SessionFixture } from "./session";
import { createSessionFixture } from "./session";

const {
  ingestKeys,
  member,
  organization,
  projectMembers,
  projects,
  session: sessionTable,
  user: userTable,
} = schema;

export interface ProjectRbacFixture {
  admin: SessionFixture;
  orgId: string;
  projectId: string;
  projectSlug: string;
  viewer: SessionFixture;
  workspaceSlug: string;
}

export async function createProjectRbacFixture(): Promise<ProjectRbacFixture> {
  const admin = await createSessionFixture({
    orgSlug: "rbac-co",
    token: "session-token-rbac-admin",
    userId: "user_rbac_admin",
    withOrganization: true,
  });

  const db = createDbClient(process.env.DATABASE_URL!);
  const orgId = "org_e2e_gate";
  const workspaceSlug = "rbac-co";
  const projectId = "prj_e2e_rbac";
  const projectSlug = "platform";

  await db.insert(projects).values({
    id: projectId,
    name: "Platform",
    organizationId: orgId,
    slug: projectSlug,
  });

  await db.insert(projectMembers).values({
    projectId,
    role: "admin",
    userId: admin.userId,
  });

  await db.insert(ingestKeys).values({
    id: "ing_e2e_rbac",
    keyHash: "hash",
    keyPrefix: "12345678",
    projectId,
  });

  await db.insert(userTable).values({
    createdAt: new Date(),
    email: "viewer@example.com",
    emailVerified: true,
    id: "user_rbac_viewer",
    name: "Viewer User",
    updatedAt: new Date(),
  });

  await db.insert(member).values({
    createdAt: new Date(),
    id: "member_rbac_viewer",
    organizationId: orgId,
    role: "member",
    userId: "user_rbac_viewer",
  });

  await db.insert(sessionTable).values({
    activeOrganizationId: orgId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    id: "session_rbac_viewer",
    token: "session-token-rbac-viewer",
    updatedAt: new Date(),
    userId: "user_rbac_viewer",
  });

  const secret =
    process.env.BETTER_AUTH_SECRET ??
    "test-better-auth-secret-min-32-characters";
  const viewerCookieValue = `session-token-rbac-viewer.${await makeSignature("session-token-rbac-viewer", secret)}`;

  const viewer: SessionFixture = {
    cookieHeader: `better-auth.session_token=${viewerCookieValue}`,
    cookieName: "better-auth.session_token",
    cookieValue: viewerCookieValue,
    orgSlug: workspaceSlug,
    token: "session-token-rbac-viewer",
    userId: "user_rbac_viewer",
  };

  return {
    admin,
    orgId,
    projectId,
    projectSlug,
    viewer,
    workspaceSlug,
  };
}

export async function ensureProjectMember(
  projectId: string,
  userId: string,
  role: "viewer" | "reporter" | "developer" | "admin"
): Promise<void> {
  const db = createDbClient(process.env.DATABASE_URL!);

  await db.delete(projectMembers).where(eq(projectMembers.userId, userId));

  await db.insert(projectMembers).values({
    projectId,
    role,
    userId,
  });
}
