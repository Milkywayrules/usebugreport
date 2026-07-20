import type { DbClient } from "@usebugreport/db";
import { member, projectMembers, projects } from "@usebugreport/db";
import { and, eq } from "drizzle-orm";
import type { AuthContext, OrgRole, ProjectAction, ProjectRole } from "./types";
import { requireSessionUserId, ServiceError } from "./types";

export const PROJECT_ROLE_ORDER: ProjectRole[] = [
  "viewer",
  "reporter",
  "developer",
  "admin",
];

const ORG_ADMIN_OVERRIDE_ACTIONS: ProjectAction[] = [
  "project:manage_members",
  "ingest:rotate",
  "project:delete",
  "project:update",
];

const ACTION_MIN_ROLE: Record<ProjectAction, ProjectRole> = {
  "ingest:rotate": "admin",
  "ingest:submit": "reporter",
  "integration:manage": "developer",
  "linear:push": "developer",
  "project:delete": "admin",
  "project:manage_members": "admin",
  "project:read": "viewer",
  "project:update": "admin",
  "report:delete": "admin",
};

function isOrgAdmin(orgRole?: OrgRole): boolean {
  return orgRole === "owner" || orgRole === "admin";
}

function roleMeetsMin(role: ProjectRole, minRole: ProjectRole): boolean {
  return (
    PROJECT_ROLE_ORDER.indexOf(role) >= PROJECT_ROLE_ORDER.indexOf(minRole)
  );
}

export interface ResolvedProjectRole {
  role: ProjectRole | null;
  source: "membership" | "org_bypass_read" | "none";
}

export function createRBACService(db: DbClient) {
  function loadMembership(projectId: string, userId: string) {
    return db.query.projectMembers.findFirst({
      columns: { role: true },
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ),
    });
  }

  async function assertProjectInOrg(
    projectId: string,
    organizationId: string
  ): Promise<void> {
    const project = await db.query.projects.findFirst({
      columns: { id: true },
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId)
      ),
    });

    if (!project) {
      throw new ServiceError("NOT_FOUND", "Project not found.");
    }
  }

  return {
    async canPerform(
      ctx: AuthContext,
      projectId: string,
      action: ProjectAction
    ): Promise<boolean> {
      await assertProjectInOrg(projectId, ctx.organizationId);

      if (
        ORG_ADMIN_OVERRIDE_ACTIONS.includes(action) &&
        isOrgAdmin(ctx.orgRole)
      ) {
        return true;
      }

      const resolved = await this.resolveProjectRole(ctx, projectId);

      if (action === "project:read") {
        return resolved.role !== null;
      }

      if (resolved.source === "org_bypass_read" || resolved.role === null) {
        return false;
      }

      const minRole = ACTION_MIN_ROLE[action];
      return roleMeetsMin(resolved.role, minRole);
    },

    async listAccessibleProjectIds(
      ctx: AuthContext
    ): Promise<string[] | "all"> {
      if (isOrgAdmin(ctx.orgRole)) {
        return "all";
      }

      if (ctx.projectIds && ctx.projectIds.length > 0) {
        return ctx.projectIds;
      }

      const userId = requireSessionUserId(ctx);
      const rows = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .where(
          and(
            eq(projectMembers.userId, userId),
            eq(projects.organizationId, ctx.organizationId)
          )
        );

      return rows.map((row) => row.projectId);
    },

    async requireProjectRole(
      ctx: AuthContext,
      projectId: string,
      minRole: ProjectRole
    ): Promise<ProjectRole> {
      await assertProjectInOrg(projectId, ctx.organizationId);

      if (minRole === "admin" && isOrgAdmin(ctx.orgRole)) {
        return "admin";
      }

      const resolved = await this.resolveProjectRole(ctx, projectId);

      if (resolved.role && roleMeetsMin(resolved.role, minRole)) {
        return resolved.role;
      }

      throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
    },

    async resolveProjectRole(
      ctx: AuthContext,
      projectId: string
    ): Promise<ResolvedProjectRole> {
      await assertProjectInOrg(projectId, ctx.organizationId);

      if (ctx.type === "api_key") {
        return {
          role: ctx.projectIds?.includes(projectId) ? "admin" : null,
          source: "membership",
        };
      }

      const userId = requireSessionUserId(ctx);
      const membership = await loadMembership(projectId, userId);
      if (membership) {
        return { role: membership.role, source: "membership" };
      }

      if (isOrgAdmin(ctx.orgRole)) {
        return { role: "viewer", source: "org_bypass_read" };
      }

      const orgMember = await db.query.member.findFirst({
        columns: { id: true },
        where: and(
          eq(member.userId, userId),
          eq(member.organizationId, ctx.organizationId)
        ),
      });

      if (!orgMember) {
        throw new ServiceError("NOT_FOUND", "Project not found.");
      }

      return { role: null, source: "none" };
    },
  };
}

export type RBACService = ReturnType<typeof createRBACService>;
