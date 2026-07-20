import type { UsageService } from "./usage";
import { ServiceError } from "./types";

export async function assertIngestQuotaAllowed(
  usageService: Pick<UsageService, "checkQuota">,
  organizationId: string
): Promise<void> {
  const quota = await usageService.checkQuota({ organizationId });
  if (quota.allowed) {
    return;
  }

  throw new ServiceError("QUOTA_EXCEEDED", quota.message, quota.details);
}

export async function assertFinalizeEnqueueAllowed(
  getActiveFinalizeCount: ((organizationId: string) => Promise<number>) | undefined,
  organizationId: string,
  maxConcurrent = 100
): Promise<void> {
  if (!getActiveFinalizeCount) {
    return;
  }

  const active = await getActiveFinalizeCount(organizationId);
  if (active < maxConcurrent) {
    return;
  }

  throw new ServiceError(
    "RATE_LIMITED",
    "Too many ingest jobs in progress for this workspace. Try again shortly.",
    { active, limit: maxConcurrent }
  );
}
