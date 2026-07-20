import { z } from "zod";

/** AD-4 / ARCHITECTURE-SPINE: refs-only — never blob bytes. */
export const ingestFinalizePayloadSchema = z
  .object({
    idempotencyKey: z.string(),
    projectId: z.string(),
    r2Keys: z.array(z.string()),
    reportId: z.string(),
  })
  .strict();

export type IngestFinalizePayload = z.infer<typeof ingestFinalizePayloadSchema>;
