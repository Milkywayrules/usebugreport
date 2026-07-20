import type { DbClient } from "@usebugreport/db";
import { reports } from "@usebugreport/db";
import type { IngestFinalizePayload } from "@usebugreport/queue";
import type { R2Client } from "@usebugreport/storage";
import { and, eq } from "drizzle-orm";
import { generatePrefixedId } from "./project";
import { ServiceError } from "./types";

export type IngestPartName =
  | "replay"
  | "console"
  | "network"
  | "screenshot"
  | "meta";

const INGEST_PART_NAMES: IngestPartName[] = [
  "replay",
  "console",
  "network",
  "screenshot",
  "meta",
];

export interface PresignPartInput {
  contentType: string;
  name: IngestPartName;
  seq?: number;
}

export interface PresignUploadInput {
  description?: string;
  parts: PresignPartInput[];
  title?: string;
}

export interface CaptureIngestContext {
  idempotencyKey: string;
  organizationId: string;
  projectId: string;
  requestId: string;
}

export interface CaptureIngestServiceDeps {
  enqueueFinalize: (payload: IngestFinalizePayload) => Promise<void>;
  generateId?: () => string;
  r2: Pick<R2Client, "presignPut">;
}

export function buildIngestR2Key(
  organizationId: string,
  projectId: string,
  reportId: string,
  part: PresignPartInput
): string {
  const base = `${organizationId}/${projectId}/${reportId}`;
  switch (part.name) {
    case "replay":
      return `${base}/replay/batch-${part.seq ?? 0}.json.gz`;
    case "console":
      return `${base}/console.json.gz`;
    case "network":
      return `${base}/network.json.gz`;
    case "screenshot":
      return `${base}/screenshot.webp`;
    case "meta":
      return `${base}/meta.json`;
    default:
      throw new ServiceError("VALIDATION_ERROR", "Invalid upload part name.");
  }
}

function parsePresignParts(parts: PresignPartInput[]): PresignPartInput[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "At least one upload part is required."
    );
  }

  return parts.map((part) => {
    if (!INGEST_PART_NAMES.includes(part.name)) {
      throw new ServiceError("VALIDATION_ERROR", "Invalid upload part name.");
    }
    if (!part.contentType?.trim()) {
      throw new ServiceError("VALIDATION_ERROR", "contentType is required.");
    }
    if (
      part.name === "replay" &&
      part.seq !== undefined &&
      (!Number.isInteger(part.seq) || part.seq < 0)
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Replay seq must be a non-negative integer."
      );
    }
    return {
      contentType: part.contentType.trim(),
      name: part.name,
      seq: part.seq,
    };
  });
}

export function createCaptureIngestService(
  db: DbClient,
  deps: CaptureIngestServiceDeps
) {
  const generateId = deps.generateId ?? (() => generatePrefixedId("rpt"));

  async function findReportByIdempotency(
    projectId: string,
    idempotencyKey: string
  ) {
    const [existing] = await db
      .select({
        id: reports.id,
        ingestStatus: reports.ingestStatus,
        organizationId: reports.organizationId,
        projectId: reports.projectId,
      })
      .from(reports)
      .where(
        and(
          eq(reports.projectId, projectId),
          eq(reports.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);

    return existing ?? null;
  }

  return {
    async completeIngest(
      ctx: CaptureIngestContext,
      input: { reportId: string; r2Keys: string[] }
    ) {
      const reportId = input.reportId.trim();
      if (!reportId) {
        throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
      }
      if (!Array.isArray(input.r2Keys) || input.r2Keys.length === 0) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "r2Keys must include at least one key."
        );
      }

      const [report] = await db
        .select({
          id: reports.id,
          ingestStatus: reports.ingestStatus,
          organizationId: reports.organizationId,
          projectId: reports.projectId,
        })
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (!report) {
        throw new ServiceError("NOT_FOUND", "Report not found.");
      }

      if (
        report.projectId !== ctx.projectId ||
        report.organizationId !== ctx.organizationId
      ) {
        throw new ServiceError(
          "FORBIDDEN",
          "Report does not belong to this project."
        );
      }

      if (report.ingestStatus === "pending") {
        await db
          .update(reports)
          .set({ ingestStatus: "processing" })
          .where(eq(reports.id, reportId));
      }

      await deps.enqueueFinalize({
        idempotencyKey: ctx.idempotencyKey,
        projectId: ctx.projectId,
        r2Keys: input.r2Keys,
        reportId,
      });

      return { reportId, status: "processing" as const };
    },

    async presignUpload(ctx: CaptureIngestContext, input: PresignUploadInput) {
      const parts = parsePresignParts(input.parts);
      const existing = await findReportByIdempotency(
        ctx.projectId,
        ctx.idempotencyKey
      );

      let reportId: string;

      if (existing) {
        reportId = existing.id;
      } else {
        reportId = generateId();
        try {
          await db.insert(reports).values({
            description: input.description?.trim() || null,
            id: reportId,
            idempotencyKey: ctx.idempotencyKey,
            ingestStatus: "pending",
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            status: "open",
            title: input.title?.trim() || "Untitled report",
          });
        } catch (error) {
          const raced = await findReportByIdempotency(
            ctx.projectId,
            ctx.idempotencyKey
          );
          if (!raced) {
            throw error;
          }
          reportId = raced.id;
        }
      }

      const [scope] = await db
        .select({
          organizationId: reports.organizationId,
          projectId: reports.projectId,
        })
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (
        !scope ||
        scope.projectId !== ctx.projectId ||
        scope.organizationId !== ctx.organizationId
      ) {
        throw new ServiceError(
          "FORBIDDEN",
          "Report does not belong to this project."
        );
      }

      const uploads = await Promise.all(
        parts.map(async (part) => {
          const key = buildIngestR2Key(
            ctx.organizationId,
            ctx.projectId,
            reportId,
            part
          );
          const url = await deps.r2.presignPut(key, part.contentType);
          return {
            contentType: part.contentType,
            key,
            part: part.name,
            url,
          };
        })
      );

      return { reportId, uploads };
    },
  };
}

export type CaptureIngestService = ReturnType<
  typeof createCaptureIngestService
>;
