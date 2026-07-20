import { INLINE_INGEST_MAX_BYTES } from "@usebugreport/config";
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

export interface InlineIngestPart {
  body: Uint8Array;
  contentType: string;
  name: IngestPartName;
  seq?: number;
}

export interface InlineIngestInput {
  description?: string;
  parts: InlineIngestPart[];
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
  r2: Pick<R2Client, "presignPut" | "putObject">;
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

  return parts.map((part) => parsePresignPart(part));
}

const INLINE_REQUIRED_PARTS: IngestPartName[] = [
  "replay",
  "console",
  "network",
  "meta",
];

function parseInlineParts(parts: InlineIngestPart[]): InlineIngestPart[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "At least one upload part is required."
    );
  }

  const parsed = parts.map((part) => {
    const base = parsePresignPart({
      contentType: part.contentType,
      name: part.name,
      seq: part.seq,
    });
    if (!(part.body instanceof Uint8Array) || part.body.byteLength === 0) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Upload part body is required."
      );
    }
    return {
      body: part.body,
      contentType: base.contentType,
      name: base.name,
      seq: base.seq,
    };
  });

  const names = new Set(parsed.map((part) => part.name));
  for (const required of INLINE_REQUIRED_PARTS) {
    if (!names.has(required)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Missing required upload part: ${required}.`
      );
    }
  }

  return parsed;
}

function parsePresignPart(part: PresignPartInput): PresignPartInput {
  if (!INGEST_PART_NAMES.includes(part.name)) {
    throw new ServiceError("VALIDATION_ERROR", "Invalid upload part name.");
  }
  if (!part.contentType.trim()) {
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

  async function resolveInlineReportId(
    ctx: CaptureIngestContext,
    input: InlineIngestInput,
    existing: Awaited<ReturnType<typeof findReportByIdempotency>>
  ): Promise<
    | { kind: "existing"; reportId: string; status: "complete" | "processing" }
    | { kind: "pending"; reportId: string }
  > {
    if (
      existing &&
      (existing.ingestStatus === "processing" ||
        existing.ingestStatus === "complete")
    ) {
      return {
        kind: "existing",
        reportId: existing.id,
        status: existing.ingestStatus,
      };
    }

    if (existing) {
      return { kind: "pending", reportId: existing.id };
    }

    const reportId = generateId();
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
      return { kind: "pending", reportId };
    } catch (error) {
      const raced = await findReportByIdempotency(
        ctx.projectId,
        ctx.idempotencyKey
      );
      if (!raced) {
        throw error;
      }
      if (
        raced.ingestStatus === "processing" ||
        raced.ingestStatus === "complete"
      ) {
        return {
          kind: "existing",
          reportId: raced.id,
          status: raced.ingestStatus,
        };
      }
      return { kind: "pending", reportId: raced.id };
    }
  }

  function uploadInlinePartsToR2(
    ctx: CaptureIngestContext,
    reportId: string,
    parts: InlineIngestPart[]
  ): Promise<string[]> {
    const uploads = parts.map((part) => {
      const key = buildIngestR2Key(
        ctx.organizationId,
        ctx.projectId,
        reportId,
        part
      );
      return deps.r2
        .putObject(key, part.body, part.contentType)
        .then(() => key);
    });
    return Promise.all(uploads);
  }

  return {
    async acceptInlineIngest(
      ctx: CaptureIngestContext,
      input: InlineIngestInput
    ) {
      const parts = parseInlineParts(input.parts);
      const totalBytes = parts.reduce(
        (sum, part) => sum + part.body.byteLength,
        0
      );
      if (totalBytes > INLINE_INGEST_MAX_BYTES) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Inline ingest limited to 1 MB; use POST /api/v1/capture/presign for larger payloads."
        );
      }

      const existing = await findReportByIdempotency(
        ctx.projectId,
        ctx.idempotencyKey
      );
      const resolved = await resolveInlineReportId(ctx, input, existing);
      if (resolved.kind === "existing") {
        return {
          reportId: resolved.reportId,
          status: resolved.status,
        };
      }

      const r2Keys = await uploadInlinePartsToR2(ctx, resolved.reportId, parts);

      await deps.enqueueFinalize({
        idempotencyKey: ctx.idempotencyKey,
        projectId: ctx.projectId,
        r2Keys,
        reportId: resolved.reportId,
      });

      const [claimed] = await db
        .update(reports)
        .set({ ingestStatus: "processing" })
        .where(
          and(
            eq(reports.id, resolved.reportId),
            eq(reports.ingestStatus, "pending")
          )
        )
        .returning({ id: reports.id });

      if (!claimed) {
        const current = await findReportByIdempotency(
          ctx.projectId,
          ctx.idempotencyKey
        );
        return {
          reportId: resolved.reportId,
          status:
            current?.ingestStatus === "complete" ? "complete" : "processing",
        };
      }

      return { reportId: resolved.reportId, status: "processing" as const };
    },

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
