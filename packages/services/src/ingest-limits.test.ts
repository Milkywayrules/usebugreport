import { describe, expect, test } from "bun:test";
import { assertIngestQuotaAllowed, assertFinalizeEnqueueAllowed } from "./ingest-limits";
import { ServiceError } from "./types";
import type { UsageService } from "./usage";

describe("assertIngestQuotaAllowed", () => {
  test("passes when quota allows", async () => {
    const usageService = {
      checkQuota: async () => ({ allowed: true as const, current: 1, limit: 30 }),
    } satisfies Pick<UsageService, "checkQuota">;

    await expect(
      assertIngestQuotaAllowed(usageService, "org_1")
    ).resolves.toBeUndefined();
  });

  test("throws QUOTA_EXCEEDED when at cap", async () => {
    const usageService = {
      checkQuota: async () => ({
        allowed: false as const,
        capKind: "hard" as const,
        code: "QUOTA_EXCEEDED" as const,
        current: 30,
        details: { current: 30, limit: 30, resetAt: "2026-08-01T00:00:00.000Z" },
        limit: 30,
        message: "Free tier limit of 30 reports per month reached.",
      }),
    } satisfies Pick<UsageService, "checkQuota">;

    await expect(assertIngestQuotaAllowed(usageService, "org_1")).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
    });
  });
});

describe("assertFinalizeEnqueueAllowed", () => {
  test("throws RATE_LIMITED at workspace concurrency cap", async () => {
    await expect(
      assertFinalizeEnqueueAllowed(async () => 100, "org_1")
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
