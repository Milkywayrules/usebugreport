import { z } from "zod";

export const webhooksDispatchPayloadSchema = z.object({
  eventId: z.string(),
  reportId: z.string(),
  webhookId: z.string(),
});

export const webhooksDeliverPayloadSchema = z.object({
  deliveryId: z.string(),
  endpointId: z.string(),
  eventId: z.string(),
});

export type WebhooksDispatchPayload = z.infer<
  typeof webhooksDispatchPayloadSchema
>;
export type WebhooksDeliverPayload = z.infer<
  typeof webhooksDeliverPayloadSchema
>;
