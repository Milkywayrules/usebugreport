import { z } from "zod";

export const integrationsLinearPushPayloadSchema = z.object({
  operationId: z.string(),
  organizationId: z.string(),
  reportId: z.string(),
});

export type IntegrationsLinearPushPayload = z.infer<
  typeof integrationsLinearPushPayloadSchema
>;
