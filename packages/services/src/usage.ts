import {
  type BillingTier,
  getTierLimits,
  getRetentionDays as getTierRetentionDays,
  type TierLimits,
} from "@usebugreport/config";
import type { DbClient } from "@usebugreport/db";
import { member, organization, workspaceUsageMonthly } from "@usebugreport/db";
import { and, eq, sql } from "drizzle-orm";
import type { R2Client } from "@usebugreport/storage";
import { createRetentionService } from "./retention";
import { ServiceError } from "./types";
import type {
  IncrementOptions,
  MonthlyUsage,
  QuotaCheckResult,
  ResolvedOrgBilling,
  RetentionDays,
  TierCheckResult,
  TierLimitType,
  UsageContext,
} from "./types";

export interface UsageServiceDeps {
  r2?: R2Client;
  countIntegrations?: (organizationId: string) => Promise<number>;
  countOwnedWorkspaces?: (userId: string) => Promise<number>;
  getMonthlyReportCount?: (
    organizationId: string,
    yearMonth: string
  ) => Promise<number>;
  incrementMonthlyUsage?: (
    organizationId: string,
    yearMonth: string,
    delta: number
  ) => Promise<void>;
  resolveOrgBilling?: (
    organizationId: string
  ) => Promise<ResolvedOrgBilling | null>;
}

function currentUtcYearMonth(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

function nextUtcMonthResetAt(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  ).toISOString();
}

function normalizeLimitType(
  limitType: TierLimitType | "rest_write"
): TierLimitType {
  return limitType === "rest_write" ? "mcp_write" : limitType;
}

function applyRetentionOverride(
  override: number | null | undefined,
  tierMax: number | null
): number | null {
  if (tierMax === null) {
    return tierMax;
  }
  if (override === null || override === undefined) {
    return tierMax;
  }
  return Math.min(override, tierMax);
}

function tierForbidden(
  message: string,
  details?: Record<string, unknown>
): TierCheckResult {
  return { allowed: false, code: "FORBIDDEN", details, message };
}

function checkBooleanGate(allowed: boolean, message: string): TierCheckResult {
  return allowed ? { allowed: true } : tierForbidden(message);
}

function checkCountGate(
  current: number,
  max: number | null,
  tier: BillingTier,
  resourceLabel: string,
  upgradeVerb: string
): TierCheckResult {
  if (max === null) {
    return { allowed: true };
  }

  if (current >= max) {
    return tierForbidden(
      `${resourceLabel} limit of ${max} reached for ${tier} tier. Upgrade to ${upgradeVerb}.`,
      { current, limit: max, tier }
    );
  }

  return { allowed: true };
}

async function checkWorkspaceLimit(
  ctx: UsageContext,
  limits: TierLimits,
  tier: BillingTier,
  countOwnedWorkspaces: (userId: string) => Promise<number>
): Promise<TierCheckResult> {
  if (!ctx.userId) {
    return tierForbidden("User ID is required to check workspace limits.");
  }

  const owned = await countOwnedWorkspaces(ctx.userId);
  return checkCountGate(
    owned,
    limits.maxWorkspacesPerUser,
    tier,
    "Workspace",
    "create more workspaces"
  );
}

async function checkIntegrationLimit(
  organizationId: string,
  limits: TierLimits,
  tier: BillingTier,
  countIntegrations: (organizationId: string) => Promise<number>
): Promise<TierCheckResult> {
  const connected = await countIntegrations(organizationId);
  return checkCountGate(
    connected,
    limits.maxIntegrationsPerWorkspace,
    tier,
    "Integration",
    "connect more integrations"
  );
}

async function evaluateTierLimit(
  ctx: UsageContext,
  limitType: TierLimitType,
  tier: BillingTier,
  limits: TierLimits,
  countOwnedWorkspaces: (userId: string) => Promise<number>,
  countIntegrations: (organizationId: string) => Promise<number>
): Promise<TierCheckResult> {
  switch (limitType) {
    case "webhooks":
      return checkBooleanGate(
        limits.webhooksAllowed,
        "Webhooks require Pro tier or higher."
      );
    case "mcp_write":
      return checkBooleanGate(
        limits.mcpWriteAllowed,
        "MCP and REST write access requires Pro tier or higher."
      );
    case "workspaces":
      return await checkWorkspaceLimit(ctx, limits, tier, countOwnedWorkspaces);
    case "integrations":
      return await checkIntegrationLimit(
        ctx.organizationId,
        limits,
        tier,
        countIntegrations
      );
    default:
      return tierForbidden(`Unsupported tier limit type: ${limitType}`);
  }
}

export function createUsageService(db: DbClient, deps: UsageServiceDeps = {}) {
  async function resolveOrgBilling(
    organizationId: string
  ): Promise<ResolvedOrgBilling | null> {
    if (deps.resolveOrgBilling) {
      return deps.resolveOrgBilling(organizationId);
    }

    const row = await db.query.organization.findFirst({
      columns: {
        billingTier: true,
        retentionDaysReplay: true,
        retentionDaysScreenshot: true,
      },
      where: eq(organization.id, organizationId),
    });

    if (!row) {
      return null;
    }

    return {
      billingTier: row.billingTier,
      retentionDaysReplay: row.retentionDaysReplay,
      retentionDaysScreenshot: row.retentionDaysScreenshot,
    };
  }

  async function resolveOrgTier(organizationId: string): Promise<BillingTier> {
    const org = await resolveOrgBilling(organizationId);
    return org?.billingTier ?? "free";
  }

  async function countOwnedWorkspaces(userId: string): Promise<number> {
    if (deps.countOwnedWorkspaces) {
      return deps.countOwnedWorkspaces(userId);
    }

    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.role, "owner")));

    return rows[0]?.count ?? 0;
  }

  function countIntegrations(organizationId: string): Promise<number> {
    if (deps.countIntegrations) {
      return deps.countIntegrations(organizationId);
    }

    // Integrations table lands in E7-S1; default to zero connected integrations.
    return Promise.resolve(0);
  }

  async function getMonthlyReportCount(
    organizationId: string,
    yearMonth: string
  ): Promise<number> {
    if (deps.getMonthlyReportCount) {
      return deps.getMonthlyReportCount(organizationId, yearMonth);
    }

    const row = await db.query.workspaceUsageMonthly.findFirst({
      columns: { reportCount: true },
      where: and(
        eq(workspaceUsageMonthly.organizationId, organizationId),
        eq(workspaceUsageMonthly.yearMonth, yearMonth)
      ),
    });

    return row?.reportCount ?? 0;
  }

  async function incrementMonthlyUsage(
    organizationId: string,
    yearMonth: string,
    delta: number
  ): Promise<void> {
    if (deps.incrementMonthlyUsage) {
      await deps.incrementMonthlyUsage(organizationId, yearMonth, delta);
      return;
    }

    await db
      .insert(workspaceUsageMonthly)
      .values({
        organizationId,
        reportCount: delta,
        yearMonth,
      })
      .onConflictDoUpdate({
        set: {
          reportCount: sql`${workspaceUsageMonthly.reportCount} + ${delta}`,
        },
        target: [
          workspaceUsageMonthly.organizationId,
          workspaceUsageMonthly.yearMonth,
        ],
      });
  }

  const usageService = {
    async checkQuota(ctx: UsageContext): Promise<QuotaCheckResult> {
      const tier = await resolveOrgTier(ctx.organizationId);
      const limits = getTierLimits(tier);
      const yearMonth = currentUtcYearMonth();
      const current = await getMonthlyReportCount(
        ctx.organizationId,
        yearMonth
      );
      const limit = limits.maxReportsPerMonth;

      if (limit === null) {
        return { allowed: true, current, limit: null };
      }

      if (current < limit) {
        return { allowed: true, current, limit };
      }

      const resetAt = nextUtcMonthResetAt();
      const capKind = limits.reportCapKind;

      return {
        allowed: false,
        capKind,
        code: "QUOTA_EXCEEDED",
        details: { current, limit, resetAt },
        message:
          capKind === "hard"
            ? `Free tier limit of ${limit} reports per month reached.`
            : `Pro tier fair-use limit of ${limit} reports per month reached.`,
      };
    },

    async checkTierLimit(
      ctx: UsageContext,
      limitType: TierLimitType | "rest_write"
    ): Promise<TierCheckResult> {
      const normalizedLimit = normalizeLimitType(limitType);
      const tier = await resolveOrgTier(ctx.organizationId);
      const limits = getTierLimits(tier);

      return evaluateTierLimit(
        ctx,
        normalizedLimit,
        tier,
        limits,
        countOwnedWorkspaces,
        countIntegrations
      );
    },

    async getMonthlyUsage(ctx: UsageContext): Promise<MonthlyUsage> {
      const yearMonth = currentUtcYearMonth();
      const reportCount = await getMonthlyReportCount(
        ctx.organizationId,
        yearMonth
      );

      return { reportCount, yearMonth };
    },

    async getRetentionDays(organizationId: string): Promise<RetentionDays> {
      const org = await resolveOrgBilling(organizationId);
      const tier = org?.billingTier ?? "free";
      const tierRetention = getTierRetentionDays(tier);

      return {
        metadataDays: tierRetention.metadataDays,
        replayDays: applyRetentionOverride(
          org?.retentionDaysReplay,
          tierRetention.replayDays
        ),
        screenshotDays: applyRetentionOverride(
          org?.retentionDaysScreenshot,
          tierRetention.screenshotDays
        ),
      };
    },

    async increment(
      ctx: UsageContext,
      opts: IncrementOptions = {}
    ): Promise<MonthlyUsage> {
      const delta = opts.delta ?? 1;
      const yearMonth = currentUtcYearMonth();

      await incrementMonthlyUsage(ctx.organizationId, yearMonth, delta);

      const reportCount = await getMonthlyReportCount(
        ctx.organizationId,
        yearMonth
      );

      return { reportCount, yearMonth };
    },

    async recomputeRetention(organizationId: string): Promise<{ updated: number }> {
      if (!deps.r2) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Retention recompute requires R2 configuration."
        );
      }

      const retentionService = createRetentionService(db, {
        getRetentionDays: (orgId) => usageService.getRetentionDays(orgId),
        r2: deps.r2,
      });

      const updated =
        await retentionService.recomputeBlobExpiry(organizationId);
      return { updated };
    },

  };

  return usageService;
}

export type UsageService = ReturnType<typeof createUsageService>;
