import type { DbClient } from "@usebugreport/db";
import { member, projectMembers, projects } from "@usebugreport/db";
import type { AuthContext, OrgRole } from "@usebugreport/services";
import { and, eq } from "drizzle-orm";
import type { SessionContext } from "./session";

function activeOrganizationId(
  session: SessionContext["session"]
): string | null {
  return (
    (session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? null
  );
}

export async function resolveAuthContext(
  db: DbClient,
  sessionContext: SessionContext,
  organizationId?: string
): Promise<AuthContext | { error: "NO_ACTIVE_ORG" }> {
  const orgId = organizationId ?? activeOrganizationId(sessionContext.session);

  if (!orgId) {
    return { error: "NO_ACTIVE_ORG" };
  }

  const membership = await db.query.member.findFirst({
    columns: { role: true },
    where: and(
      eq(member.userId, sessionContext.user.id),
      eq(member.organizationId, orgId)
    ),
  });

  const projectRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, sessionContext.user.id),
        eq(projects.organizationId, orgId)
      )
    );

  return {
    organizationId: orgId,
    orgRole: membership?.role as OrgRole | undefined,
    projectIds: projectRows.map((row) => row.projectId),
    requestId: sessionContext.requestId,
    type: "session",
    userId: sessionContext.user.id,
  };
}

export { activeOrganizationId };
