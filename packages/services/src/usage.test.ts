import { describe, expect, test } from "bun:test";
import {
  type BillingTier,
  getRetentionDays,
  getTierLimits,
  isSellableTier,
  MCP_WRITE_LIMIT,
  TIER_LIMITS,
} from "@usebugreport/config";
import type { DbClient } from "@usebugreport/db";
import type { ResolvedOrgBilling, UsageContext } from "./types";
import { createUsageService, type UsageServiceDeps } from "./usage";

const dummyDb = {} as DbClient;

const orgId = "org_test";
const userId = "user_test";
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}T/;
const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

function orgTier(tier: BillingTier): UsageServiceDeps {
  return {
    resolveOrgBilling: async (): Promise<ResolvedOrgBilling> => ({
      billingTier: tier,
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    }),
  };
}

function usageFixture(initialCount = 0): UsageServiceDeps {
  const store = new Map<string, number>();

  if (initialCount > 0) {
    store.set(`${orgId}:2026-07`, initialCount);
  }

  return {
    getMonthlyReportCount: async (organizationId, yearMonth) =>
      store.get(`${organizationId}:${yearMonth}`) ?? 0,
    incrementMonthlyUsage: (organizationId, yearMonth, delta) => {
      const key = `${organizationId}:${yearMonth}`;
      store.set(key, (store.get(key) ?? 0) + delta);
      return Promise.resolve();
    },
    resolveOrgBilling: async () => ({
      billingTier: "free",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    }),
  };
}

describe("getTierLimits", () => {
  test("Free tier constants match PRD §9", () => {
    const limits = getTierLimits("free");
    expect(limits.maxWorkspacesPerUser).toBe(1);
    expect(limits.maxReportsPerMonth).toBe(30);
    expect(limits.reportCapKind).toBe("hard");
    expect(limits.maxIntegrationsPerWorkspace).toBe(1);
    expect(limits.webhooksAllowed).toBe(false);
    expect(limits.mcpWriteAllowed).toBe(false);
    expect(limits.retention).toEqual({
      metadataDays: 30,
      replayDays: 7,
      screenshotDays: 7,
    });
    expect(isSellableTier("free")).toBe(true);
  });

  test("Pro tier constants match PRD §9", () => {
    const limits = getTierLimits("pro");
    expect(limits.maxWorkspacesPerUser).toBe(5);
    expect(limits.maxReportsPerMonth).toBe(2000);
    expect(limits.reportCapKind).toBe("soft");
    expect(limits.maxIntegrationsPerWorkspace).toBeNull();
    expect(limits.webhooksAllowed).toBe(true);
    expect(limits.mcpWriteAllowed).toBe(true);
    expect(limits.retention).toEqual({
      metadataDays: null,
      replayDays: 30,
      screenshotDays: 90,
    });
    expect(isSellableTier("pro")).toBe(true);
  });

  test("Studio and Agency stub tiers are defined but not sellable", () => {
    for (const tier of ["studio", "agency"] as const) {
      const limits = getTierLimits(tier);
      expect(limits.sellable).toBe(false);
      expect(isSellableTier(tier)).toBe(false);
      expect(limits.maxWorkspacesPerUser).toBeNull();
      expect(limits.maxIntegrationsPerWorkspace).toBeNull();
      expect(limits.mcpWriteAllowed).toBe(true);
      expect(limits.retention.replayDays).toBe(90);
      expect(limits.retention.screenshotDays).toBe(90);
    }
  });

  test("TIER_LIMITS covers all billing tiers", () => {
    expect(Object.keys(TIER_LIMITS).sort()).toEqual([
      "agency",
      "free",
      "pro",
      "studio",
    ]);
  });
});

describe("checkTierLimit → workspaces", () => {
  const ctx: UsageContext = { organizationId: orgId, userId };

  test("Free: zero owned workspaces allows create", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("free"),
      countOwnedWorkspaces: async () => 0,
    });

    expect(await service.checkTierLimit(ctx, "workspaces")).toEqual({
      allowed: true,
    });
  });

  test("Free: one owned workspace blocks second", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("free"),
      countOwnedWorkspaces: async () => 1,
    });

    const result = await service.checkTierLimit(ctx, "workspaces");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  test("Pro: four owned workspaces allows fifth", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("pro"),
      countOwnedWorkspaces: async () => 4,
    });

    expect(await service.checkTierLimit(ctx, "workspaces")).toEqual({
      allowed: true,
    });
  });

  test("Pro: five owned workspaces blocks sixth", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("pro"),
      countOwnedWorkspaces: async () => 5,
    });

    const result = await service.checkTierLimit(ctx, "workspaces");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });
});

describe("checkTierLimit → integrations", () => {
  const ctx: UsageContext = { organizationId: orgId, userId };

  test("Free: zero integrations allows connect", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("free"),
      countIntegrations: async () => 0,
    });

    expect(await service.checkTierLimit(ctx, "integrations")).toEqual({
      allowed: true,
    });
  });

  test("Free: one integration blocks second", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("free"),
      countIntegrations: async () => 1,
    });

    const result = await service.checkTierLimit(ctx, "integrations");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  test("Pro: high integration count remains allowed", async () => {
    const service = createUsageService(dummyDb, {
      ...orgTier("pro"),
      countIntegrations: async () => 100,
    });

    expect(await service.checkTierLimit(ctx, "integrations")).toEqual({
      allowed: true,
    });
  });
});

describe("checkTierLimit → webhooks", () => {
  const ctx: UsageContext = { organizationId: orgId, userId };

  test("Free tier denies webhooks", async () => {
    const service = createUsageService(dummyDb, orgTier("free"));
    const result = await service.checkTierLimit(ctx, "webhooks");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  test("Pro tier allows webhooks", async () => {
    const service = createUsageService(dummyDb, orgTier("pro"));
    expect(await service.checkTierLimit(ctx, "webhooks")).toEqual({
      allowed: true,
    });
  });
});

describe("checkTierLimit → mcp_write", () => {
  const ctx: UsageContext = { organizationId: orgId, userId };

  test("Free tier denies MCP/REST write", async () => {
    const service = createUsageService(dummyDb, orgTier("free"));
    const result = await service.checkTierLimit(ctx, "mcp_write");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  test("Pro tier allows MCP/REST write", async () => {
    const service = createUsageService(dummyDb, orgTier("pro"));
    expect(await service.checkTierLimit(ctx, "mcp_write")).toEqual({
      allowed: true,
    });
  });

  test("rest_write alias maps to mcp_write gate", async () => {
    const service = createUsageService(dummyDb, orgTier("free"));
    const result = await service.checkTierLimit(ctx, "rest_write");
    expect(result.allowed).toBe(false);
  });

  test("Studio stub tier allows MCP/REST write", async () => {
    const service = createUsageService(dummyDb, orgTier("studio"));
    expect(await service.checkTierLimit(ctx, MCP_WRITE_LIMIT)).toEqual({
      allowed: true,
    });
  });
});

describe("checkQuota", () => {
  const ctx: UsageContext = { organizationId: orgId };

  test("Free: 29 reports allowed", async () => {
    const deps = usageFixture(29);
    deps.resolveOrgBilling = async () => ({
      billingTier: "free",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });
    const service = createUsageService(dummyDb, deps);

    const result = await service.checkQuota(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(29);
      expect(result.limit).toBe(30);
    }
  });

  test("Free: 30 reports blocked with hard capKind", async () => {
    const deps = usageFixture(30);
    deps.resolveOrgBilling = async () => ({
      billingTier: "free",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });
    const service = createUsageService(dummyDb, deps);

    const result = await service.checkQuota(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("QUOTA_EXCEEDED");
      expect(result.capKind).toBe("hard");
      expect(result.details.limit).toBe(30);
      expect(result.details.current).toBe(30);
      expect(result.details.resetAt).toMatch(ISO_DATE_PREFIX);
    }
  });

  test("Pro: 1999 reports allowed", async () => {
    const deps = usageFixture(1999);
    deps.resolveOrgBilling = async () => ({
      billingTier: "pro",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });
    const service = createUsageService(dummyDb, deps);

    const result = await service.checkQuota(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(1999);
      expect(result.limit).toBe(2000);
    }
  });

  test("Pro: 2000 reports blocked with soft capKind", async () => {
    const deps = usageFixture(2000);
    deps.resolveOrgBilling = async () => ({
      billingTier: "pro",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });
    const service = createUsageService(dummyDb, deps);

    const result = await service.checkQuota(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("QUOTA_EXCEEDED");
      expect(result.capKind).toBe("soft");
      expect(result.details.limit).toBe(2000);
    }
  });

  test("hard and soft capKind are distinct", async () => {
    const freeDeps = usageFixture(30);
    freeDeps.resolveOrgBilling = async () => ({
      billingTier: "free",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });
    const proDeps = usageFixture(2000);
    proDeps.resolveOrgBilling = async () => ({
      billingTier: "pro",
      retentionDaysReplay: null,
      retentionDaysScreenshot: null,
    });

    const freeResult = await createUsageService(dummyDb, freeDeps).checkQuota(
      ctx
    );
    const proResult = await createUsageService(dummyDb, proDeps).checkQuota(
      ctx
    );

    expect(freeResult.allowed).toBe(false);
    expect(proResult.allowed).toBe(false);
    if (!(freeResult.allowed || proResult.allowed)) {
      expect(freeResult.capKind).toBe("hard");
      expect(proResult.capKind).toBe("soft");
      expect(freeResult.capKind).not.toBe(proResult.capKind);
    }
  });
});

describe("increment and getMonthlyUsage", () => {
  const ctx: UsageContext = { organizationId: orgId };

  test("defaults delta to 1 and reads back count", async () => {
    const deps = usageFixture();
    const service = createUsageService(dummyDb, deps);

    await service.increment(ctx);
    const usage = await service.getMonthlyUsage(ctx);

    expect(usage.reportCount).toBe(1);
    expect(usage.yearMonth).toMatch(YEAR_MONTH_PATTERN);
  });

  test("increments by custom delta", async () => {
    const deps = usageFixture();
    const service = createUsageService(dummyDb, deps);

    await service.increment(ctx, { delta: 5 });
    await service.increment(ctx, { delta: 3 });

    const usage = await service.getMonthlyUsage(ctx);
    expect(usage.reportCount).toBe(8);
  });
});

describe("getRetentionDays", () => {
  test("Free tier returns 7/7/30", async () => {
    const service = createUsageService(dummyDb, orgTier("free"));
    expect(await service.getRetentionDays(orgId)).toEqual({
      metadataDays: 30,
      replayDays: 7,
      screenshotDays: 7,
    });
  });

  test("Pro tier returns 30/90/null", async () => {
    const service = createUsageService(dummyDb, orgTier("pro"));
    expect(await service.getRetentionDays(orgId)).toEqual({
      metadataDays: null,
      replayDays: 30,
      screenshotDays: 90,
    });
  });

  test("Studio stub returns 90/90/null", async () => {
    const service = createUsageService(dummyDb, orgTier("studio"));
    expect(await service.getRetentionDays(orgId)).toEqual({
      metadataDays: null,
      replayDays: 90,
      screenshotDays: 90,
    });
  });

  test("org override uses min(override, tierMax)", async () => {
    const service = createUsageService(dummyDb, {
      resolveOrgBilling: async () => ({
        billingTier: "pro",
        retentionDaysReplay: 45,
        retentionDaysScreenshot: 120,
      }),
    });

    expect(await service.getRetentionDays(orgId)).toEqual({
      metadataDays: null,
      replayDays: 30,
      screenshotDays: 90,
    });
  });

  test("config getRetentionDays matches tier table", () => {
    expect(getRetentionDays("free")).toEqual({
      metadataDays: 30,
      replayDays: 7,
      screenshotDays: 7,
    });
  });
});
