import { z } from "zod";

export const QUEUE_NAMES = {
  DELETION_STEP: "deletion.step",
  INGEST_FINALIZE: "ingest.finalize",
  RETENTION_SWEEP: "retention.sweep",
  WEBHOOK_DISPATCH: "webhook.dispatch",
} as const;

/** AD-4 / ARCHITECTURE-SPINE: refs-only payloads — never blob bytes. */
export const ingestFinalizePayloadSchema = z.object({
  idempotencyKey: z.string(),
  projectId: z.string(),
  r2Keys: z.array(z.string()),
  reportId: z.string(),
});

export const webhookDispatchPayloadSchema = z.object({
  eventId: z.string(),
  reportId: z.string(),
  webhookId: z.string(),
});

export const deletionStepPayloadSchema = z.object({
  organizationId: z.string(),
  step: z.string(),
  tombstoneId: z.string(),
});

export const retentionSweepPayloadSchema = z.object({
  organizationId: z.string(),
  sweepDate: z.string(),
});

export type IngestFinalizePayload = z.infer<typeof ingestFinalizePayloadSchema>;
export type WebhookDispatchPayload = z.infer<
  typeof webhookDispatchPayloadSchema
>;
export type DeletionStepPayload = z.infer<typeof deletionStepPayloadSchema>;
export type RetentionSweepPayload = z.infer<typeof retentionSweepPayloadSchema>;
