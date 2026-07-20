import type { DbClient } from "@usebugreport/db";
import type { R2Client } from "@usebugreport/storage";
import {
  auditLog,
  deletionTombstones,
  ingestKeys,
  integrationOperations,
  integrations,
  member,
  organization,
  projects,
  reportBlobs,
  reportComments,
  reports,
  user,
  webhookDeliveries,
  webhookEndpoints,
  workspaceApiKeys,
  workspaceUsageMonthly,
} from "@usebugreport/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { sendDeletionLifecycleEmail } from "./deletion-email";
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

const R2_DELETE_BATCH_SIZE = 1000;

export async function purgeOrganizationR2Prefix(
  r2: R2Client,
  organizationId: string
): Promise<number> {
  const prefix = `${organizationId}/`;
  const objects = await r2.listObjects(prefix);
  let removed = 0;
  for (let index = 0; index < objects.length; index += R2_DELETE_BATCH_SIZE) {
    const batch = objects.slice(index, index + R2_DELETE_BATCH_SIZE);
    for (const object of batch) {
      try {
        await r2.deleteObject(object.key);
        removed += 1;
      } catch {
        // idempotent — missing keys are fine on retry
      }
    }
  }
  return removed;
}

export interface DeletionServiceDeps {
  enqueueDeletionJob: (
    jobName: DeletionJobName,
    payload: DeletionEnqueuePayload
  ) => Promise<void>;
  purgeOrgRedisKeys: (organizationId: string, projectIds: string[]) => Promise<void>;
  r2: R2Client;
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

    async processExternalPurge(payload: DeletionEnqueuePayload): Promise<number> {
      const [tombstone] = await db
        .select()
        .from(deletionTombstones)
        .where(eq(deletionTombstones.id, payload.tombstoneId))
        .limit(1);

      if (!tombstone || tombstone.organizationId !== payload.organizationId) {
        throw new ServiceError("NOT_FOUND", "Deletion tombstone not found.");
      }

      if (stepRank(tombstone.lastCompletedStep) >= stepRank(DELETION_STEPS.EXTERNAL_PURGE)) {
        return 0;
      }

      if (stepRank(tombstone.lastCompletedStep) < stepRank(DELETION_STEPS.NOTIFY)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "External purge cannot run before notify step completes."
        );
      }

      const projectRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.organizationId, payload.organizationId));

      const removedObjects = await purgeOrganizationR2Prefix(deps.r2, payload.organizationId);
      await deps.purgeOrgRedisKeys(
        payload.organizationId,
        projectRows.map((row) => row.id)
      );

      await db
        .update(deletionTombstones)
        .set({
          lastCompletedStep: DELETION_STEPS.EXTERNAL_PURGE,
          status: "external_purge",
        })
        .where(eq(deletionTombstones.id, payload.tombstoneId));

      await deps.enqueueDeletionJob("deletion.audit_terminal", payload);

      return removedObjects;
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

      await sendDeletionLifecycleEmail({
        organizationSlug: tombstone.organizationSlug,
        ownerEmail: tombstone.ownerEmail,
        phase: "started",
      });

      await deps.enqueueDeletionJob("deletion.external_purge", payload);
    },

    async processAuditTerminal(payload: DeletionEnqueuePayload): Promise<void> {
      const [tombstone] = await db
        .select()
        .from(deletionTombstones)
        .where(eq(deletionTombstones.id, payload.tombstoneId))
        .limit(1);

      if (!tombstone || tombstone.organizationId !== payload.organizationId) {
        throw new ServiceError("NOT_FOUND", "Deletion tombstone not found.");
      }

      if (stepRank(tombstone.lastCompletedStep) >= stepRank(DELETION_STEPS.AUDIT_TERMINAL)) {
        return;
      }

      if (stepRank(tombstone.lastCompletedStep) < stepRank(DELETION_STEPS.EXTERNAL_PURGE)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Audit terminal cannot run before external purge completes."
        );
      }

      const [[reportCountRow], [commentCountRow], [projectCountRow]] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(reports)
          .where(eq(reports.organizationId, payload.organizationId)),
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(reportComments)
          .where(eq(reportComments.organizationId, payload.organizationId)),
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(projects)
          .where(eq(projects.organizationId, payload.organizationId)),
      ]);

      const auditMetadata = {
        commentCount: commentCountRow?.count ?? 0,
        organizationId: payload.organizationId,
        organizationSlug: tombstone.organizationSlug,
        projectCount: projectCountRow?.count ?? 0,
        reportCount: reportCountRow?.count ?? 0,
        tombstoneId: payload.tombstoneId,
      };

      const auditId = generatePrefixedId("aud");
      await db.insert(auditLog).values({
        eventType: "workspace.deletion.terminal",
        id: auditId,
        metadata: auditMetadata,
        organizationId: payload.organizationId,
        tombstoneId: payload.tombstoneId,
      });

      await db
        .update(deletionTombstones)
        .set({
          auditMetadata,
          lastCompletedStep: DELETION_STEPS.AUDIT_TERMINAL,
          status: "audit_terminal",
        })
        .where(eq(deletionTombstones.id, payload.tombstoneId));

      await deps.enqueueDeletionJob("deletion.postgres_purge", payload);
    },

    async processPostgresPurge(payload: DeletionEnqueuePayload): Promise<void> {
      const [tombstone] = await db
        .select()
        .from(deletionTombstones)
        .where(eq(deletionTombstones.id, payload.tombstoneId))
        .limit(1);

      if (!tombstone || tombstone.organizationId !== payload.organizationId) {
        throw new ServiceError("NOT_FOUND", "Deletion tombstone not found.");
      }

      if (tombstone.status === "complete") {
        return;
      }

      if (stepRank(tombstone.lastCompletedStep) >= stepRank(DELETION_STEPS.POSTGRES_PURGE)) {
        return;
      }

      if (stepRank(tombstone.lastCompletedStep) < stepRank(DELETION_STEPS.AUDIT_TERMINAL)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Postgres purge cannot run before audit terminal completes."
        );
      }

      const organizationId = payload.organizationId;
      const projectRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.organizationId, organizationId));
      const projectIds = projectRows.map((row) => row.id);

      const reportRows =
        projectIds.length === 0
          ? []
          : await db
              .select({ id: reports.id })
              .from(reports)
              .where(eq(reports.organizationId, organizationId));
      const reportIds = reportRows.map((row) => row.id);

      await db
        .delete(integrationOperations)
        .where(eq(integrationOperations.organizationId, organizationId));

      await db
        .delete(reportComments)
        .where(eq(reportComments.organizationId, organizationId));

      if (reportIds.length > 0) {
        await db.delete(reportBlobs).where(inArray(reportBlobs.reportId, reportIds));
        await db.delete(reports).where(eq(reports.organizationId, organizationId));
      }

      if (projectIds.length > 0) {
        await db.delete(projects).where(eq(projects.organizationId, organizationId));
      }

      await db.delete(integrations).where(eq(integrations.organizationId, organizationId));

      const endpointRows = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.organizationId, organizationId));
      const endpointIds = endpointRows.map((row) => row.id);
      if (endpointIds.length > 0) {
        await db
          .delete(webhookDeliveries)
          .where(inArray(webhookDeliveries.endpointId, endpointIds));
      }
      await db
        .delete(webhookEndpoints)
        .where(eq(webhookEndpoints.organizationId, organizationId));

      await db
        .delete(workspaceApiKeys)
        .where(eq(workspaceApiKeys.organizationId, organizationId));

      await db
        .delete(workspaceUsageMonthly)
        .where(eq(workspaceUsageMonthly.organizationId, organizationId));

      await db.delete(organization).where(eq(organization.id, organizationId));

      await db
        .update(auditLog)
        .set({ organizationId: null })
        .where(eq(auditLog.organizationId, organizationId));

      await sendDeletionLifecycleEmail({
        organizationSlug: tombstone.organizationSlug,
        ownerEmail: tombstone.ownerEmail,
        phase: "complete",
      });

      await db
        .update(deletionTombstones)
        .set({
          completedAt: new Date(),
          lastCompletedStep: DELETION_STEPS.POSTGRES_PURGE,
          status: "complete",
        })
        .where(eq(deletionTombstones.id, payload.tombstoneId));
    },

    revokeWorkspaceAccess,
  };
}

export type DeletionService = ReturnType<typeof createDeletionService>;
