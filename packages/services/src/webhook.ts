import type { DbClient } from "@usebugreport/db";
import { webhookEndpoints } from "@usebugreport/db";
import { eq } from "drizzle-orm";
import { encryptSecret } from "./crypto/secrets";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { ServiceError } from "./types";
import type { UsageService } from "./usage";

export const WEBHOOK_LAUNCH_EVENTS = [
  "report.created",
  "report.updated",
] as const;

export type WebhookLaunchEvent = (typeof WEBHOOK_LAUNCH_EVENTS)[number];

export interface RegisterWebhookInput {
  enabled?: boolean;
  events: WebhookLaunchEvent[];
  url: string;
}

export interface WebhookEndpointRecord {
  createdAt: Date;
  enabled: boolean;
  events: WebhookLaunchEvent[];
  id: string;
  organizationId: string;
  url: string;
}

export interface WebhookServiceDeps {
  encryptionKey: string;
  usageService: UsageService;
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

function normalizeEvents(events: string[]): WebhookLaunchEvent[] {
  if (events.length === 0) {
    throw new ServiceError("VALIDATION_ERROR", "At least one event is required.");
  }
  const invalid = events.filter(
    (event) => !WEBHOOK_LAUNCH_EVENTS.includes(event as WebhookLaunchEvent)
  );
  if (invalid.length > 0) {
    throw new ServiceError("VALIDATION_ERROR", "Unsupported webhook event.", {
      invalidEvents: invalid,
    });
  }
  return events as WebhookLaunchEvent[];
}

function mapRow(row: typeof webhookEndpoints.$inferSelect): WebhookEndpointRecord {
  return {
    createdAt: row.createdAt,
    enabled: row.enabled,
    events: row.events as WebhookLaunchEvent[],
    id: row.id,
    organizationId: row.organizationId,
    url: row.url,
  };
}

export function createWebhookService(db: DbClient, deps: WebhookServiceDeps) {
  return {
    async listEndpoints(ctx: AuthContext): Promise<WebhookEndpointRecord[]> {
      const rows = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.organizationId, ctx.organizationId));
      return rows.map(mapRow);
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
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
