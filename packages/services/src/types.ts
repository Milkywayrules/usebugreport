import type { BillingTier } from "@usebugreport/config";

export type TierLimitType =
  | "workspaces"
  | "integrations"
  | "webhooks"
  | "mcp_write";

/** Alias for MCP/REST write tier gate — canonical name is `mcp_write`. */
export type RestWriteLimitType = "mcp_write";

export interface UsageContext {
  organizationId: string;
  userId?: string;
}

export type TierCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "FORBIDDEN" | "QUOTA_EXCEEDED";
      message: string;
      details?: Record<string, unknown>;
    };

export type QuotaCheckResult =
  | { allowed: true; current: number; limit: number | null }
  | {
      allowed: false;
      code: "QUOTA_EXCEEDED";
      capKind: "hard" | "soft";
      message: string;
      details: { current: number; limit: number; resetAt: string };
    };

export interface MonthlyUsage {
  reportCount: number;
  yearMonth: string;
}

export interface RetentionDays {
  metadataDays: number | null;
  replayDays: number | null;
  screenshotDays: number | null;
}

export interface IncrementOptions {
  delta?: number;
}

export interface ResolvedOrgBilling {
  billingTier: BillingTier;
  retentionDaysReplay: number | null;
  retentionDaysScreenshot: number | null;
}
