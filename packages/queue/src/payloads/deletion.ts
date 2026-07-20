import { z } from "zod";

export const deletionStepPayloadSchema = z.object({
  organizationId: z.string(),
  step: z.string(),
  tombstoneId: z.string(),
});

export type DeletionStepPayload = z.infer<typeof deletionStepPayloadSchema>;
