export {
  type ApiKeyRow,
  type ApiKeyService,
  type CreateApiKeyResult,
  createApiKeyService,
  generateLiveKeyPlaintext,
  LIVE_KEY_PREFIX,
  requireApiKeyScope,
} from "./api-key";
export {
  buildIngestR2Key,
  type CaptureIngestContext,
  type CaptureIngestService,
  type CaptureIngestServiceDeps,
  createCaptureIngestService,
  type IngestPartName,
  type InlineIngestInput,
  type InlineIngestPart,
  type PresignPartInput,
  type PresignUploadInput,
} from "./ingest";
export {
  createProjectService,
  generatePrefixedId,
  type ProjectService,
} from "./project";
export {
  createRBACService,
  PROJECT_ROLE_ORDER,
  type RBACService,
  type ResolvedProjectRole,
} from "./rbac";
export {
  createReportService,
  type ReplayManifest,
  type ReplayManifestBatch,
  type ReportRecord,
  type ReportService,
  type ReportServiceDeps,
} from "./report";
export {
  createSearchService,
  type SearchReportHit,
  type SearchReportsOptions,
  type SearchService,
} from "./search";
export type {
  ApiKeyScope,
  AuthContext,
  CursorPage,
  IncrementOptions,
  MonthlyUsage,
  OrgRole,
  ProjectAction,
  ProjectRole,
  QuotaCheckResult,
  ResolvedOrgBilling,
  RestWriteLimitType,
  RetentionDays,
  ServiceErrorCode,
  TierCheckResult,
  TierLimitType,
  UsageContext,
} from "./types";
export {
  API_KEY_SCOPES,
  FREE_TIER_API_KEY_SCOPES,
  requireSessionUserId,
  ServiceError,
} from "./types";
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
