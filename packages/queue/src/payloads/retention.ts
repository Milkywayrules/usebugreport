import { z } from "zod";

export const retentionSweepPayloadSchema = z.object({
  organizationId: z.string(),
  sweepDate: z.string(),
});

export type RetentionSweepPayload = z.infer<typeof retentionSweepPayloadSchema>;
