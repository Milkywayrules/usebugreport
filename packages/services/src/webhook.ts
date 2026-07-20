import type { DbClient } from "@usebugreport/db";
import { reportComments, reports, webhookDeliveries, webhookEndpoints } from "@usebugreport/db";
import { and, desc, eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./crypto/secrets";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { ServiceError } from "./types";
import type { UsageService } from "./usage";
import { postWebhookPayload } from "./webhook-delivery-http";
import { assertWebhookHostSafe } from "./webhook-ssrf";
import {
  buildWebhookSignature,
  webhookTimestampSeconds,
} from "./webhook-sign";

export const WEBHOOK_LAUNCH_EVENTS = [
  "report.created",
  "report.updated",
] as const;

export const WEBHOOK_FAST_FOLLOW_EVENTS = ["report.comment.created"] as const;

export const WEBHOOK_EVENTS = [
  ...WEBHOOK_LAUNCH_EVENTS,
  ...WEBHOOK_FAST_FOLLOW_EVENTS,
] as const;

export type WebhookLaunchEvent = (typeof WEBHOOK_LAUNCH_EVENTS)[number];
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookDeliveryStatus = "delivered" | "failed" | "pending";

export const WEBHOOK_RETRY_DELAYS_MS = [0, 60_000, 300_000, 1_800_000, 7_200_000];

export interface RegisterWebhookInput {
  enabled?: boolean;
  events: WebhookEvent[];
  url: string;
}

export interface WebhookEndpointRecord {
  createdAt: Date;
  enabled: boolean;
  events: WebhookEvent[];
  id: string;
  organizationId: string;
  url: string;
}

export interface WebhookServiceDeps {
  encryptionKey: string;
  usageService: UsageService;
}

export interface WebhookDispatchInput {
  commentId?: string;
  event: WebhookEvent;
  eventId: string;
  organizationId: string;
  reportId: string;
  webhookId: string;
}

function assertHttpsUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError("VALIDATION_ERROR", "Webhook URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new ServiceError("VALIDATION_ERROR", "Webhook URL must use HTTPS.");
  }
}

function normalizeEvents(events: string[]): WebhookEvent[] {
  if (events.length === 0) {
    throw new ServiceError("VALIDATION_ERROR", "At least one event is required.");
  }
  const invalid = events.filter(
    (event) => !WEBHOOK_EVENTS.includes(event as WebhookEvent)
  );
  if (invalid.length > 0) {
    throw new ServiceError("VALIDATION_ERROR", "Unsupported webhook event.", {
      invalidEvents: invalid,
    });
  }
  return events as WebhookEvent[];
}

function mapRow(row: typeof webhookEndpoints.$inferSelect): WebhookEndpointRecord {
  return {
    createdAt: row.createdAt,
    enabled: row.enabled,
    events: row.events as WebhookEvent[],
    id: row.id,
    organizationId: row.organizationId,
    url: row.url,
  };
}



function serializeCommentPayload(comment: {
  authorDisplayName: string;
  authorType: string;
  body: string;
  createdAt: Date;
  id: string;
  reportId: string;
}) {
  return {
    authorDisplayName: comment.authorDisplayName,
    authorType: comment.authorType,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    reportId: comment.reportId,
  };
}

function serializeReportPayload(report: {
  createdAt: Date;
  id: string;
  organizationId: string;
  projectId: string;
  status: string;
  title: string;
  updatedAt: Date;
}) {
  return {
    createdAt: report.createdAt.toISOString(),
    id: report.id,
    organizationId: report.organizationId,
    projectId: report.projectId,
    status: report.status,
    title: report.title,
    updatedAt: report.updatedAt.toISOString(),
  };
}



export function formatWebhookDeliveryError(input: {
  attempts: number;
  lastResponseCode: number | null;
  status: WebhookDeliveryStatus | string;
}): string | null {
  if (input.status === "delivered") {
    return null;
  }
  if (input.status === "pending") {
    return "Delivery pending or scheduled for retry.";
  }
  if (input.lastResponseCode === null) {
    return "Delivery failed without an HTTP response (timeout, TLS, or blocked host).";
  }
  return `HTTP ${input.lastResponseCode} after ${input.attempts} attempt(s).`;
}

function assertWebhookAdmin(ctx: AuthContext): void {
  if (ctx.orgRole !== "owner" && ctx.orgRole !== "admin") {
    throw new ServiceError("FORBIDDEN", "Organization admin access required.");
  }
}

export function createWebhookService(db: DbClient, deps: WebhookServiceDeps) {
  return {

    async listDeliveries(
      ctx: AuthContext,
      limit = 50
    ): Promise<
      Array<{
        attempts: number;
        createdAt: Date;
        endpointId: string;
        endpointUrl: string;
        errorSummary: string | null;
        event: string;
        id: string;
        lastResponseCode: number | null;
        status: WebhookDeliveryStatus;
      }>
    > {
      assertWebhookAdmin(ctx);
      const cappedLimit = Math.min(Math.max(limit, 1), 100);
      const rows = await db
        .select({
          attempts: webhookDeliveries.attempts,
          createdAt: webhookDeliveries.createdAt,
          endpointId: webhookDeliveries.endpointId,
          endpointUrl: webhookEndpoints.url,
          event: webhookDeliveries.event,
          id: webhookDeliveries.id,
          lastResponseCode: webhookDeliveries.lastResponseCode,
          status: webhookDeliveries.status,
        })
        .from(webhookDeliveries)
        .innerJoin(
          webhookEndpoints,
          eq(webhookDeliveries.endpointId, webhookEndpoints.id)
        )
        .where(eq(webhookEndpoints.organizationId, ctx.organizationId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(cappedLimit);

      return rows.map((row) => ({
        attempts: row.attempts,
        createdAt: row.createdAt,
        endpointId: row.endpointId,
        endpointUrl: row.endpointUrl,
        errorSummary: formatWebhookDeliveryError({
          attempts: row.attempts,
          lastResponseCode: row.lastResponseCode,
          status: row.status as WebhookDeliveryStatus,
        }),
        event: row.event,
        id: row.id,
        lastResponseCode: row.lastResponseCode,
        status: row.status as WebhookDeliveryStatus,
      }));
    },

    async listEndpoints(ctx: AuthContext): Promise<WebhookEndpointRecord[]> {
      const rows = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.organizationId, ctx.organizationId));
      return rows.map(mapRow);
    },

    async listActiveEndpointsForEvent(
      organizationId: string,
      event: WebhookEvent
    ): Promise<Array<{ id: string }>> {
      const rows = await db
        .select({ events: webhookEndpoints.events, id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(
          and(
            eq(webhookEndpoints.organizationId, organizationId),
            eq(webhookEndpoints.enabled, true)
          )
        );
      return rows
        .filter((row) => (row.events as WebhookEvent[]).includes(event))
        .map((row) => ({ id: row.id }));
    },

    async register(
      ctx: AuthContext,
      input: RegisterWebhookInput
    ): Promise<WebhookEndpointRecord> {
      const tier = await deps.usageService.checkTierLimit(ctx, "webhooks");
      if (!tier.allowed) {
        throw new ServiceError("FORBIDDEN", tier.message ?? "Webhooks require Pro tier.");
      }

      assertHttpsUrl(input.url);
      await assertWebhookHostSafe(new URL(input.url).hostname);
      const events = normalizeEvents(input.events);

      const secretPlaintext = crypto.randomUUID().replace(/-/g, "");
      const secretEncrypted = await encryptSecret(secretPlaintext, deps.encryptionKey);

      const id = generatePrefixedId("whk");
      const [row] = await db
        .insert(webhookEndpoints)
        .values({
          enabled: input.enabled ?? true,
          events,
          id,
          organizationId: ctx.organizationId,
          secretEncrypted,
          url: input.url,
        })
        .returning();

      if (!row) {
        throw new ServiceError("VALIDATION_ERROR", "Webhook registration failed.");
      }

      return mapRow(row);
    },

    async processDispatchJob(input: WebhookDispatchInput): Promise<{ deliveryId: string }> {
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, input.webhookId))
        .limit(1);

      if (!endpoint || endpoint.organizationId !== input.organizationId) {
        throw new ServiceError("NOT_FOUND", "Webhook endpoint not found.");
      }

      if (!endpoint.enabled) {
        throw new ServiceError("VALIDATION_ERROR", "Webhook endpoint is disabled.");
      }

      const events = endpoint.events as WebhookEvent[];
      if (!events.includes(input.event)) {
        throw new ServiceError("VALIDATION_ERROR", "Webhook endpoint does not subscribe to event.");
      }

      const [report] = await db
        .select({
          createdAt: reports.createdAt,
          id: reports.id,
          organizationId: reports.organizationId,
          projectId: reports.projectId,
          status: reports.status,
          title: reports.title,
          updatedAt: reports.updatedAt,
        })
        .from(reports)
        .where(
          and(
            eq(reports.id, input.reportId),
            eq(reports.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!report) {
        throw new ServiceError("NOT_FOUND", "Report not found for webhook dispatch.");
      }

      let payload: {
        data: Record<string, unknown>;
        id: string;
        type: string;
      };

      if (input.event === "report.comment.created") {
        if (!input.commentId) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "commentId is required for report.comment.created."
          );
        }

        const [comment] = await db
          .select({
            authorDisplayName: reportComments.authorDisplayName,
            authorType: reportComments.authorType,
            body: reportComments.body,
            createdAt: reportComments.createdAt,
            id: reportComments.id,
            reportId: reportComments.reportId,
          })
          .from(reportComments)
          .where(
            and(
              eq(reportComments.id, input.commentId),
              eq(reportComments.reportId, input.reportId),
              eq(reportComments.organizationId, input.organizationId)
            )
          )
          .limit(1);

        if (!comment) {
          throw new ServiceError("NOT_FOUND", "Comment not found for webhook dispatch.");
        }

        payload = {
          data: {
            comment: serializeCommentPayload(comment),
            report: serializeReportPayload(report),
          },
          id: input.eventId,
          type: input.event,
        };
      } else {
        payload = {
          data: { report: serializeReportPayload(report) },
          id: input.eventId,
          type: input.event,
        };
      }

      const deliveryId = generatePrefixedId("whd");
      const now = new Date();
      await db.insert(webhookDeliveries).values({
        attempts: 0,
        createdAt: now,
        endpointId: endpoint.id,
        event: input.event,
        id: deliveryId,
        nextAttemptAt: now,
        payload,
        status: "pending",
      });

      return { deliveryId };
    },

    async processDeliverJob(deliveryId: string): Promise<{ retryDelayMs?: number }> {
      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .limit(1);

      if (!delivery) {
        throw new ServiceError("NOT_FOUND", "Webhook delivery not found.");
      }

      if (delivery.status === "delivered") {
        return {};
      }

      if (delivery.status === "failed") {
        return {};
      }

      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, delivery.endpointId))
        .limit(1);

      if (!endpoint) {
        await db
          .update(webhookDeliveries)
          .set({ status: "failed" })
          .where(eq(webhookDeliveries.id, deliveryId));
        return {};
      }

      const attemptNumber = delivery.attempts + 1;
      const rawBody = JSON.stringify(delivery.payload);
      const timestamp = webhookTimestampSeconds();
      const secret = await decryptSecret(endpoint.secretEncrypted, deps.encryptionKey);
      const signature = buildWebhookSignature(secret, timestamp, rawBody);

      const result = await postWebhookPayload(endpoint.url, {
        "X-UseBugReport-Signature": signature,
        "X-UseBugReport-Timestamp": timestamp,
      }, rawBody);

      if (result.ssrfBlocked) {
        await db
          .update(webhookDeliveries)
          .set({
            attempts: attemptNumber,
            lastResponseCode: null,
            nextAttemptAt: null,
            status: "failed",
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        return {};
      }

      const success =
        result.responseCode !== null &&
        result.responseCode >= 200 &&
        result.responseCode < 300;

      if (success) {
        await db
          .update(webhookDeliveries)
          .set({
            attempts: attemptNumber,
            lastResponseCode: result.responseCode,
            nextAttemptAt: null,
            status: "delivered",
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        return {};
      }

      const maxAttempts = WEBHOOK_RETRY_DELAYS_MS.length;
      if (attemptNumber >= maxAttempts) {
        await db
          .update(webhookDeliveries)
          .set({
            attempts: attemptNumber,
            lastResponseCode: result.responseCode,
            nextAttemptAt: null,
            status: "failed",
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        return {};
      }

      const delayMs = WEBHOOK_RETRY_DELAYS_MS[attemptNumber] ?? 0;
      const nextAttemptAt = new Date(Date.now() + delayMs);
      await db
        .update(webhookDeliveries)
        .set({
          attempts: attemptNumber,
          lastResponseCode: result.responseCode,
          nextAttemptAt,
          status: "pending",
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      return { retryDelayMs: delayMs };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
