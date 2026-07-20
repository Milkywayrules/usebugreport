import {
  LINEAR_WEBHOOK_SIGNATURE_HEADER,
  LINEAR_WEBHOOK_TS_HEADER,
  LinearWebhookClient,
  type LinearWebhookPayload,
} from "@linear/sdk/webhooks";
import type { DbClient } from "@usebugreport/db";
import { integrations, reports } from "@usebugreport/db";
import { and, eq, isNull } from "drizzle-orm";
import { ServiceError } from "./types";

export type ReportStatus =
  | "closed"
  | "duplicate"
  | "in_progress"
  | "open"
  | "resolved";

export interface LinearIntegrationStatusConfig {
  statusMapping?: Record<string, ReportStatus>;
}

const DEFAULT_STATE_TYPE_MAP: Record<string, ReportStatus> = {
  backlog: "open",
  canceled: "closed",
  completed: "resolved",
  started: "in_progress",
  unstarted: "open",
};

export function mapLinearStateToReportStatus(
  stateName: string | null | undefined,
  stateType: string | null | undefined,
  config: LinearIntegrationStatusConfig
): ReportStatus | null {
  const mapping = config.statusMapping ?? {};
  const normalizedName = stateName?.trim().toLowerCase();
  if (normalizedName) {
    const mapped = mapping[normalizedName] ?? mapping[stateName!.trim()];
    if (mapped) {
      return mapped;
    }
  }

  const normalizedType = stateType?.trim().toLowerCase();
  if (normalizedType && DEFAULT_STATE_TYPE_MAP[normalizedType]) {
    return DEFAULT_STATE_TYPE_MAP[normalizedType];
  }

  return null;
}

function extractIssueUpdate(payload: LinearWebhookPayload): {
  issueId: string;
  stateName?: string;
  stateType?: string;
} | null {
  if (payload.type !== "Issue") {
    return null;
  }
  if (payload.action !== "create" && payload.action !== "update") {
    return null;
  }

  const data = payload.data as {
    id?: string;
    state?: { name?: string; type?: string };
  };

  if (!data.id) {
    return null;
  }

  return {
    issueId: data.id,
    stateName: data.state?.name,
    stateType: data.state?.type,
  };
}

export function createLinearInboundHandlers(db: DbClient) {
  return {
    async handleWebhook(input: {
      rawBody: string;
      signature: string | null;
      timestamp: string | null;
      webhookSecret: string;
    }): Promise<{ acknowledged: true; updated: boolean }> {
      if (!input.webhookSecret) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Linear webhook secret is not configured."
        );
      }
      if (!input.signature) {
        throw new ServiceError("FORBIDDEN", "Missing Linear webhook signature.");
      }

      const client = new LinearWebhookClient(input.webhookSecret);
      const payload = client.parseData(
        Buffer.from(input.rawBody, "utf8"),
        input.signature,
        input.timestamp ?? undefined
      );

      const issueUpdate = extractIssueUpdate(payload);
      if (!issueUpdate) {
        return { acknowledged: true, updated: false };
      }

      const report = await db.query.reports.findFirst({
        columns: {
          id: true,
          organizationId: true,
          projectId: true,
          status: true,
        },
        where: eq(reports.linearIssueId, issueUpdate.issueId),
      });

      if (!report) {
        return { acknowledged: true, updated: false };
      }

      const integration = await db.query.integrations.findFirst({
        columns: { config: true, id: true },
        where: and(
          eq(integrations.organizationId, report.organizationId),
          eq(integrations.type, "linear"),
          isNull(integrations.revokedAt)
        ),
      });

      if (!integration) {
        return { acknowledged: true, updated: false };
      }

      const mapped = mapLinearStateToReportStatus(
        issueUpdate.stateName,
        issueUpdate.stateType,
        (integration.config ?? {}) as LinearIntegrationStatusConfig
      );

      if (!mapped || mapped === report.status) {
        return { acknowledged: true, updated: false };
      }

      await db
        .update(reports)
        .set({ status: mapped, updatedAt: new Date() })
        .where(eq(reports.id, report.id));

      return { acknowledged: true, updated: true };
    },
  };
}

export type LinearInboundHandlers = ReturnType<typeof createLinearInboundHandlers>;
