export {
  createProjectService,
  generatePrefixedId,
  type ProjectService,
} from "./project";
export type {
  AuthContext,
  CursorPage,
  IncrementOptions,
  MonthlyUsage,
  QuotaCheckResult,
  ResolvedOrgBilling,
  RestWriteLimitType,
  RetentionDays,
  ServiceErrorCode,
  TierCheckResult,
  TierLimitType,
  UsageContext,
} from "./types";
export { ServiceError } from "./types";
export {
  createUsageService,
  type UsageService,
  type UsageServiceDeps,
} from "./usage";
export {
  createWorkspaceService,
  MAX_PINNED_WORKSPACES,
  slugifyWorkspaceName,
  type WorkspaceAuthApi,
  type WorkspaceService,
  type WorkspaceServiceDeps,
} from "./workspace";

/** Health probe flag — domain services package is no longer a stub. */
export const servicesReady = true;
