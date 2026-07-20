import { z } from "zod";

export const webhookEventSchema = z.enum([
  "report.created",
  "report.updated",
  "report.comment.created",
]);

export const webhooksDispatchPayloadSchema = z.object({
  event: webhookEventSchema,
  eventId: z.string(),
  organizationId: z.string(),
  commentId: z.string().optional(),
  reportId: z.string(),
  webhookId: z.string(),
});

export const webhooksDeliverPayloadSchema = z.object({
  deliveryId: z.string(),
});

export type WebhooksDispatchPayload = z.infer<
  typeof webhooksDispatchPayloadSchema
>;
export type WebhooksDeliverPayload = z.infer<
  typeof webhooksDeliverPayloadSchema
>;
