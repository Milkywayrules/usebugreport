import { z } from "zod";

export const billingTierSchema = z.enum(["free", "pro", "studio", "agency"]);

export type BillingTier = z.infer<typeof billingTierSchema>;

export type ReportCapKind = "hard" | "soft";

export interface TierRetention {
  metadataDays: number | null;
  replayDays: number;
  screenshotDays: number;
}

export interface TierLimits {
  maxIntegrationsPerWorkspace: number | null;
  maxReportsPerMonth: number | null;
  maxWorkspacesPerUser: number | null;
  mcpWriteAllowed: boolean;
  reportCapKind: ReportCapKind;
  retention: TierRetention;
  sellable: boolean;
  webhooksAllowed: boolean;
}

export const TIER_LIMITS: Record<BillingTier, TierLimits> = {
  agency: {
    maxIntegrationsPerWorkspace: null,
    maxReportsPerMonth: null,
    maxWorkspacesPerUser: null,
    mcpWriteAllowed: true,
    reportCapKind: "soft",
    retention: { metadataDays: null, replayDays: 90, screenshotDays: 90 },
    sellable: false,
    webhooksAllowed: true,
  },
  free: {
    maxIntegrationsPerWorkspace: 1,
    maxReportsPerMonth: 30,
    maxWorkspacesPerUser: 1,
    mcpWriteAllowed: false,
    reportCapKind: "hard",
    retention: { metadataDays: 30, replayDays: 7, screenshotDays: 7 },
    sellable: true,
    webhooksAllowed: false,
  },
  pro: {
    maxIntegrationsPerWorkspace: null,
    maxReportsPerMonth: 2000,
    maxWorkspacesPerUser: 5,
    mcpWriteAllowed: true,
    reportCapKind: "soft",
    retention: { metadataDays: null, replayDays: 30, screenshotDays: 90 },
    sellable: true,
    webhooksAllowed: true,
  },
  studio: {
    maxIntegrationsPerWorkspace: null,
    maxReportsPerMonth: null,
    maxWorkspacesPerUser: null,
    mcpWriteAllowed: true,
    reportCapKind: "soft",
    retention: { metadataDays: null, replayDays: 90, screenshotDays: 90 },
    sellable: false,
    webhooksAllowed: true,
  },
} as const;

export function getTierLimits(tier: BillingTier): TierLimits {
  return TIER_LIMITS[tier];
}

export function getRetentionDays(tier: BillingTier): TierRetention {
  return getTierLimits(tier).retention;
}

export function isSellableTier(tier: BillingTier): boolean {
  return getTierLimits(tier).sellable;
}

/** Canonical limit type for MCP/REST write gates (AD-11). */
export const MCP_WRITE_LIMIT = "mcp_write" as const;
