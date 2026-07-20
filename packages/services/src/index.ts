export type {
  IncrementOptions,
  MonthlyUsage,
  QuotaCheckResult,
  ResolvedOrgBilling,
  RestWriteLimitType,
  RetentionDays,
  TierCheckResult,
  TierLimitType,
  UsageContext,
} from "./types";
export {
  createUsageService,
  type UsageService,
  type UsageServiceDeps,
} from "./usage";

/** Health probe flag — domain services package is no longer a stub. */
export const servicesReady = true;
