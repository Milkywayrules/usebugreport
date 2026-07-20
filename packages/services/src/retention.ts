import type { DbClient } from "@usebugreport/db";
import { reportBlobs, reports } from "@usebugreport/db";
import type { R2Client } from "@usebugreport/storage";
import { and, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import type { RetentionDays } from "./types";

const MS_PER_DAY = 86_400_000;
const STALE_PENDING_MS = 24 * MS_PER_DAY;
const ORPHAN_MIN_AGE_MS = 24 * MS_PER_DAY;

export interface RetentionSweepStats {
  expiredBlobsRemoved: number;
  metadataStubsApplied: number;
  orphanKeysRemoved: number;
  stalePendingReportsRemoved: number;
}

export interface RetentionServiceDeps {
  getRetentionDays: (organizationId: string) => Promise<RetentionDays>;
  r2: R2Client;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

function retentionDaysForBlobType(
  blobType: (typeof reportBlobs.$inferSelect)["type"],
  retention: RetentionDays
): number {
  if (blobType === "screenshot") {
    return retention.screenshotDays ?? retention.replayDays ?? 7;
  }
  return retention.replayDays ?? 7;
}

async function deleteR2KeysBestEffort(
  r2: R2Client,
  keys: string[]
): Promise<void> {
  for (const key of keys) {
    try {
      await r2.deleteObject(key);
    } catch {
      // best-effort orphan / stale cleanup
    }
  }
}

export function createRetentionService(
  db: DbClient,
  deps: RetentionServiceDeps
) {
  async function deleteExpiredBlobs(
    organizationId: string,
    now: Date
  ): Promise<number> {
    const rows = await db
      .select({
        blobId: reportBlobs.id,
        r2Key: reportBlobs.r2Key,
      })
      .from(reportBlobs)
      .innerJoin(reports, eq(reportBlobs.reportId, reports.id))
      .where(
        and(
          eq(reports.organizationId, organizationId),
          lt(reportBlobs.expiresAt, now)
        )
      );

    if (rows.length === 0) {
      return 0;
    }

    await deleteR2KeysBestEffort(
      deps.r2,
      rows.map((row) => row.r2Key)
    );

    await db.delete(reportBlobs).where(
      inArray(
        reportBlobs.id,
        rows.map((row) => row.blobId)
      )
    );

    return rows.length;
  }

  async function applyMetadataStubTransitions(
    organizationId: string,
    now: Date
  ): Promise<number> {
    const retention = await deps.getRetentionDays(organizationId);
    if (retention.metadataDays === null) {
      return 0;
    }

    const metadataCutoff = addDays(now, -retention.metadataDays);

    const candidateReports = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.organizationId, organizationId),
          or(
            lt(reports.createdAt, metadataCutoff),
            and(isNotNull(reports.metadataRetentionUntil), lt(reports.metadataRetentionUntil, now))
          )
        )
      );

    if (candidateReports.length === 0) {
      return 0;
    }

    let stubsApplied = 0;

    for (const report of candidateReports) {
      const blobs = await db
        .select({ id: reportBlobs.id, r2Key: reportBlobs.r2Key })
        .from(reportBlobs)
        .where(eq(reportBlobs.reportId, report.id));

      if (blobs.length === 0) {
        continue;
      }

      await deleteR2KeysBestEffort(
        deps.r2,
        blobs.map((blob) => blob.r2Key)
      );
      await db
        .delete(reportBlobs)
        .where(eq(reportBlobs.reportId, report.id));

      await db
        .update(reports)
        .set({ metadataRetentionUntil: now })
        .where(eq(reports.id, report.id));

      stubsApplied += 1;
    }

    return stubsApplied;
  }

  async function deleteStalePendingReports(
    organizationId: string,
    now: Date
  ): Promise<number> {
    const staleBefore = new Date(now.getTime() - STALE_PENDING_MS);

    const staleReports = await db
      .select({
        id: reports.id,
        projectId: reports.projectId,
      })
      .from(reports)
      .where(
        and(
          eq(reports.organizationId, organizationId),
          eq(reports.ingestStatus, "pending"),
          lt(reports.createdAt, staleBefore)
        )
      );

    if (staleReports.length === 0) {
      return 0;
    }

    for (const report of staleReports) {
      const blobs = await db
        .select({ r2Key: reportBlobs.r2Key })
        .from(reportBlobs)
        .where(eq(reportBlobs.reportId, report.id));

      const prefix = `${organizationId}/${report.projectId}/${report.id}/`;
      const keys = new Set(blobs.map((blob) => blob.r2Key));
      for (const object of await deps.r2.listObjects(prefix)) {
        keys.add(object.key);
      }

      await deleteR2KeysBestEffort(deps.r2, [...keys]);
    }

    await db.delete(reports).where(
      inArray(
        reports.id,
        staleReports.map((report) => report.id)
      )
    );

    return staleReports.length;
  }

  async function reconcileOrphanR2Keys(
    organizationId: string,
    now: Date
  ): Promise<number> {
    const listed = await deps.r2.listObjects(`${organizationId}/`);
    if (listed.length === 0) {
      return 0;
    }

    const knownKeys = new Set(
      (
        await db
          .select({ r2Key: reportBlobs.r2Key })
          .from(reportBlobs)
          .innerJoin(reports, eq(reportBlobs.reportId, reports.id))
          .where(eq(reports.organizationId, organizationId))
      ).map((row) => row.r2Key)
    );

    const orphanCutoff = new Date(now.getTime() - ORPHAN_MIN_AGE_MS);
    const orphanKeys = listed
      .filter((object) => {
        if (knownKeys.has(object.key)) {
          return false;
        }
        if (!object.lastModified) {
          return true;
        }
        return object.lastModified < orphanCutoff;
      })
      .map((object) => object.key);

    await deleteR2KeysBestEffort(deps.r2, orphanKeys);
    return orphanKeys.length;
  }

  return {
    async recomputeBlobExpiry(organizationId: string): Promise<number> {
      const retention =
        await deps.getRetentionDays(organizationId);
      const now = new Date();

      const rows = await db
        .select({
          blobId: reportBlobs.id,
          createdAt: reportBlobs.createdAt,
          expiresAt: reportBlobs.expiresAt,
          type: reportBlobs.type,
        })
        .from(reportBlobs)
        .innerJoin(reports, eq(reportBlobs.reportId, reports.id))
        .where(eq(reports.organizationId, organizationId));

      let updated = 0;

      for (const row of rows) {
        if (row.expiresAt < now) {
          continue;
        }

        const days = retentionDaysForBlobType(row.type, retention);
        const target = addDays(row.createdAt, days);
        let nextExpires: Date;
        if (target.getTime() > row.expiresAt.getTime()) {
          nextExpires = target;
        } else if (target.getTime() < row.expiresAt.getTime()) {
          nextExpires = new Date(Math.max(target.getTime(), now.getTime()));
        } else {
          continue;
        }

        if (nextExpires.getTime() === row.expiresAt.getTime()) {
          continue;
        }

        await db
          .update(reportBlobs)
          .set({ expiresAt: nextExpires })
          .where(eq(reportBlobs.id, row.blobId));
        updated += 1;
      }

      return updated;
    },

    async runSweep(
      organizationId: string,
      sweepDate = new Date()
    ): Promise<RetentionSweepStats> {
      const expiredBlobsRemoved = await deleteExpiredBlobs(
        organizationId,
        sweepDate
      );
      const metadataStubsApplied = await applyMetadataStubTransitions(
        organizationId,
        sweepDate
      );
      const stalePendingReportsRemoved = await deleteStalePendingReports(
        organizationId,
        sweepDate
      );
      const orphanKeysRemoved = await reconcileOrphanR2Keys(
        organizationId,
        sweepDate
      );

      return {
        expiredBlobsRemoved,
        metadataStubsApplied,
        orphanKeysRemoved,
        stalePendingReportsRemoved,
      };
    },
  };
}

export type RetentionService = ReturnType<typeof createRetentionService>;
