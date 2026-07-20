import type { DbClient } from "@usebugreport/db";
import {
  deletionTombstones,
  ingestKeys,
  member,
  organization,
  projects,
  user,
  webhookEndpoints,
  workspaceApiKeys,
} from "@usebugreport/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { requireSessionUserId, ServiceError } from "./types";

export const DELETION_STEPS = {
  AUDIT_TERMINAL: "audit_terminal",
  EXTERNAL_PURGE: "external_purge",
  NOTIFY: "notify",
  POSTGRES_PURGE: "postgres_purge",
  REVOKE_ACCESS: "revoke_access",
} as const;

export type DeletionStep = (typeof DELETION_STEPS)[keyof typeof DELETION_STEPS];

export type DeletionJobName =
  | "deletion.notify_owner"
  | "deletion.external_purge"
  | "deletion.audit_terminal"
  | "deletion.postgres_purge";

export interface DeletionEnqueuePayload {
  organizationId: string;
  tombstoneId: string;
}

export interface DeletionServiceDeps {
  enqueueDeletionJob: (
    jobName: DeletionJobName,
    payload: DeletionEnqueuePayload
  ) => Promise<void>;
}

function stepRank(step: string | null | undefined): number {
  const order: DeletionStep[] = [
    DELETION_STEPS.REVOKE_ACCESS,
    DELETION_STEPS.NOTIFY,
    DELETION_STEPS.EXTERNAL_PURGE,
    DELETION_STEPS.AUDIT_TERMINAL,
    DELETION_STEPS.POSTGRES_PURGE,
  ];
  if (!step) {
    return -1;
  }
  return order.indexOf(step as DeletionStep);
}

async function requireOrgOwner(
  db: DbClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const row = await db.query.member.findFirst({
    columns: { role: true },
    where: and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
  });
  if (!row || row.role !== "owner") {
    throw new ServiceError("FORBIDDEN", "Workspace owner access required.");
  }
}

export function createDeletionService(db: DbClient, deps: DeletionServiceDeps) {
  async function revokeWorkspaceAccess(organizationId: string): Promise<void> {
    const now = new Date();
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    for (const project of projectRows) {
      await db
        .update(ingestKeys)
        .set({ revokedAt: now })
        .where(
          and(eq(ingestKeys.projectId, project.id), isNull(ingestKeys.revokedAt))
        );
    }

    await db
      .update(workspaceApiKeys)
      .set({ revokedAt: now })
      .where(
        and(
          eq(workspaceApiKeys.organizationId, organizationId),
          isNull(workspaceApiKeys.revokedAt)
        )
      );

    await db
      .update(webhookEndpoints)
      .set({ enabled: false })
      .where(eq(webhookEndpoints.organizationId, organizationId));
  }

  return {
    async enqueueWorkspaceDeletion(ctx: AuthContext): Promise<{ tombstoneId: string }> {
      const userId = requireSessionUserId(ctx);
      await requireOrgOwner(db, userId, ctx.organizationId);

      const existing = await db.query.deletionTombstones.findFirst({
        columns: { id: true, status: true },
        where: and(
          eq(deletionTombstones.organizationId, ctx.organizationId),
          eq(deletionTombstones.status, "complete")
        ),
      });
      if (existing) {
        throw new ServiceError("VALIDATION_ERROR", "Workspace deletion already completed.");
      }

      const inProgressRows = await db
        .select({ id: deletionTombstones.id, status: deletionTombstones.status })
        .from(deletionTombstones)
        .where(eq(deletionTombstones.organizationId, ctx.organizationId));
      const inProgress = inProgressRows.find((row) => row.status !== "complete");
      if (inProgress) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Workspace deletion is already in progress."
        );
      }

      const [org] = await db
        .select({ id: organization.id, slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, ctx.organizationId))
        .limit(1);
      if (!org) {
        throw new ServiceError("NOT_FOUND", "Workspace not found.");
      }

      const [owner] = await db
        .select({ email: user.email })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.role, "owner"),
            eq(member.userId, userId)
          )
        )
        .limit(1);

      const tombstoneId = generatePrefixedId("del");
      await db.insert(deletionTombstones).values({
        id: tombstoneId,
        organizationId: ctx.organizationId,
        organizationSlug: org.slug,
        ownerEmail: owner?.email ?? "",
        requestedByUserId: userId,
        status: "queued",
      });

      await revokeWorkspaceAccess(ctx.organizationId);

      await db
        .update(deletionTombstones)
        .set({
          lastCompletedStep: DELETION_STEPS.REVOKE_ACCESS,
          status: "queued",
        })
        .where(eq(deletionTombstones.id, tombstoneId));

      await deps.enqueueDeletionJob("deletion.notify_owner", {
        organizationId: ctx.organizationId,
        tombstoneId,
      });

      return { tombstoneId };
    },

    async getDeletionStatus(
      ctx: AuthContext,
      organizationId: string
    ): Promise<{
      lastCompletedStep: string | null;
      status: string;
      tombstoneId: string | null;
    }> {
      const userId = requireSessionUserId(ctx);
      await requireOrgOwner(db, userId, organizationId);

      const [row] = await db
        .select({
          id: deletionTombstones.id,
          lastCompletedStep: deletionTombstones.lastCompletedStep,
          status: deletionTombstones.status,
        })
        .from(deletionTombstones)
        .where(eq(deletionTombstones.organizationId, organizationId))
        .orderBy(desc(deletionTombstones.startedAt))
        .limit(1);

      if (!row) {
        return { lastCompletedStep: null, status: "none", tombstoneId: null };
      }

      return {
        lastCompletedStep: row.lastCompletedStep,
        status: row.status,
        tombstoneId: row.id,
      };
    },

    async processNotifyOwner(payload: DeletionEnqueuePayload): Promise<void> {
      const [tombstone] = await db
        .select()
        .from(deletionTombstones)
        .where(eq(deletionTombstones.id, payload.tombstoneId))
        .limit(1);

      if (!tombstone || tombstone.organizationId !== payload.organizationId) {
        throw new ServiceError("NOT_FOUND", "Deletion tombstone not found.");
      }

      if (stepRank(tombstone.lastCompletedStep) >= stepRank(DELETION_STEPS.NOTIFY)) {
        return;
      }

      await db
        .update(deletionTombstones)
        .set({
          lastCompletedStep: DELETION_STEPS.NOTIFY,
          status: "notifying",
        })
        .where(eq(deletionTombstones.id, payload.tombstoneId));

      await deps.enqueueDeletionJob("deletion.external_purge", payload);
    },

    revokeWorkspaceAccess,
  };
}

export type DeletionService = ReturnType<typeof createDeletionService>;
