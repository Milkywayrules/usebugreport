import type { DbClient } from "@usebugreport/db";
import {
  member,
  organization,
  session,
  user,
  userPreferences,
} from "@usebugreport/db";
import { and, eq, sql } from "drizzle-orm";
import { generatePrefixedId } from "./project";
import type { AuthContext, ServiceErrorCode } from "./types";
import { requireSessionUserId, ServiceError } from "./types";
import type { UsageService } from "./usage";

const MAX_PINNED_WORKSPACES = 9;

export interface WorkspaceAuthApi {
  getSession: (input: {
    headers: Headers;
  }) => Promise<{ session?: { id: string } | null } | null>;
}

async function activateWorkspaceSession(
  tx: Pick<DbClient, "update">,
  authApi: WorkspaceAuthApi,
  headers: Headers,
  organizationId: string
): Promise<void> {
  const sessionResult = await authApi.getSession({ headers });
  const sessionId = sessionResult?.session?.id;
  if (!sessionId) {
    return;
  }

  await tx
    .update(session)
    .set({ activeOrganizationId: organizationId })
    .where(eq(session.id, sessionId));
}

export interface WorkspaceServiceDeps {
  authApi: WorkspaceAuthApi;
  usageService: UsageService;
}

function slugifyWorkspaceName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function requireOrgAdmin(
  db: DbClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const row = await db.query.member.findFirst({
    columns: { role: true },
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId)
    ),
  });

  if (!row || (row.role !== "owner" && row.role !== "admin")) {
    throw new ServiceError("FORBIDDEN", "Organization admin access required.");
  }
}

async function requireOrgMember(
  db: DbClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const row = await db.query.member.findFirst({
    columns: { id: true },
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId)
    ),
  });

  if (!row) {
    throw new ServiceError("NOT_FOUND", "Workspace not found.");
  }
}

export function createWorkspaceService(
  db: DbClient,
  deps: WorkspaceServiceDeps
) {
  return {
    createWorkspace(
      ctx: AuthContext,
      input: { name: string; slug?: string },
      headers: Headers
    ) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Workspace name is required."
        );
      }

      const slug = input.slug?.trim() || slugifyWorkspaceName(trimmedName);

      const userId = requireSessionUserId(ctx);

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${userId}))`
        );

        const tierCheck = await deps.usageService.checkTierLimit(
          { organizationId: "", userId },
          "workspaces"
        );

        if (!tierCheck.allowed) {
          throw new ServiceError(
            tierCheck.code as ServiceErrorCode,
            tierCheck.message,
            tierCheck.details
          );
        }

        const created = await (async () => {
          const organizationId = generatePrefixedId("org");
          const memberId = generatePrefixedId("member");
          const now = new Date();

          await tx.insert(organization).values({
            billingTier: "free",
            createdAt: now,
            id: organizationId,
            name: trimmedName,
            slug,
          });

          await tx.insert(member).values({
            createdAt: now,
            id: memberId,
            organizationId,
            role: "owner",
            userId,
          });

          return { id: organizationId, name: trimmedName, slug };
        })();

        await activateWorkspaceSession(tx, deps.authApi, headers, created.id);

        return created;
      });
    },

    async getPinnedPreferences(ctx: AuthContext) {
      const userId = requireSessionUserId(ctx);
      const row = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });

      return {
        pinnedOrder: (row?.pinnedOrder as Record<string, number> | null) ?? {},
        pinnedWorkspaceIds: row?.pinnedWorkspaceIds ?? [],
      };
    },

    async listMembers(ctx: AuthContext, organizationId: string) {
      if (ctx.organizationId !== organizationId) {
        throw new ServiceError("NOT_FOUND", "Workspace not found.");
      }

      await requireOrgAdmin(db, requireSessionUserId(ctx), organizationId);

      return db
        .select({
          email: user.email,
          name: user.name,
          role: member.role,
          userId: member.userId,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, organizationId))
        .orderBy(user.name);
    },

    async listWorkspacesForUser(ctx: AuthContext) {
      const userId = requireSessionUserId(ctx);
      const rows = await db
        .select({
          billingTier: organization.billingTier,
          createdAt: organization.createdAt,
          id: organization.id,
          name: organization.name,
          role: member.role,
          slug: organization.slug,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, userId))
        .orderBy(organization.createdAt);

      return rows;
    },

    requireOrgAdmin: (ctx: AuthContext, organizationId: string) => {
      if (!ctx.userId) {
        throw new ServiceError(
          "FORBIDDEN",
          "Organization admin access required."
        );
      }
      return requireOrgAdmin(db, ctx.userId, organizationId);
    },

    requireOrgMember: (ctx: AuthContext, organizationId: string) => {
      if (!ctx.userId) {
        throw new ServiceError("NOT_FOUND", "Workspace not found.");
      }
      return requireOrgMember(db, ctx.userId, organizationId);
    },

    async updatePinnedPreferences(
      ctx: AuthContext,
      input: {
        pinnedOrder?: Record<string, number>;
        pinnedWorkspaceIds: string[];
      }
    ) {
      const userId = requireSessionUserId(ctx);

      if (input.pinnedWorkspaceIds.length > MAX_PINNED_WORKSPACES) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `At most ${MAX_PINNED_WORKSPACES} pinned workspaces allowed.`,
          { limit: MAX_PINNED_WORKSPACES }
        );
      }

      const memberships = await db.query.member.findMany({
        columns: { organizationId: true },
        where: eq(member.userId, userId),
      });
      const allowedIds = new Set(memberships.map((row) => row.organizationId));

      for (const orgId of input.pinnedWorkspaceIds) {
        if (!allowedIds.has(orgId)) {
          throw new ServiceError(
            "FORBIDDEN",
            "Cannot pin a workspace you are not a member of."
          );
        }
      }

      const pinnedOrder = input.pinnedOrder ?? {};

      await db
        .insert(userPreferences)
        .values({
          pinnedOrder,
          pinnedWorkspaceIds: input.pinnedWorkspaceIds,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            pinnedOrder,
            pinnedWorkspaceIds: input.pinnedWorkspaceIds,
          },
          target: userPreferences.userId,
        });

      return {
        pinnedOrder,
        pinnedWorkspaceIds: input.pinnedWorkspaceIds,
      };
    },

    async updateWorkspace(
      ctx: AuthContext,
      organizationId: string,
      input: { name?: string }
    ) {
      if (ctx.organizationId !== organizationId) {
        throw new ServiceError("NOT_FOUND", "Workspace not found.");
      }

      await requireOrgAdmin(db, requireSessionUserId(ctx), organizationId);

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Workspace name is required."
        );
      }

      const [updated] = await db
        .update(organization)
        .set({ name: trimmedName })
        .where(eq(organization.id, organizationId))
        .returning({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        });

      if (!updated) {
        throw new ServiceError("NOT_FOUND", "Workspace not found.");
      }

      return updated;
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;

export { MAX_PINNED_WORKSPACES, slugifyWorkspaceName };
