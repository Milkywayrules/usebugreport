import type { BillingTier } from "@usebugreport/config";

export type OrgRole = "owner" | "admin" | "member";

export type ProjectRole = "viewer" | "reporter" | "developer" | "admin";

export type ProjectAction =
  | "project:read"
  | "ingest:submit"
  | "integration:manage"
  | "linear:push"
  | "report:delete"
  | "project:manage_members"
  | "ingest:rotate"
  | "project:delete"
  | "project:update";

export type ApiKeyScope =
  | "reports:read"
  | "reports:write"
  | "mcp:tools"
  | "webhooks:manage";

export const API_KEY_SCOPES: ApiKeyScope[] = [
  "reports:read",
  "reports:write",
  "mcp:tools",
  "webhooks:manage",
];

/** Free tier: only these scopes may be assigned at create (architecture §6). */
export const FREE_TIER_API_KEY_SCOPES: ApiKeyScope[] = [
  "reports:read",
  "mcp:tools",
];

export interface AuthContext {
  apiKeyId?: string;
  organizationId: string;
  orgRole?: OrgRole;
  projectIds?: string[];
  requestId?: string;
  scopes?: ApiKeyScope[];
  type: "session" | "api_key";
  userId?: string;
}

export type ServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ServiceErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }
}

export function requireSessionUserId(ctx: AuthContext): string {
  if (ctx.type !== "session" || !ctx.userId) {
    throw new ServiceError("FORBIDDEN", "Session required.");
  }
  return ctx.userId;
}

export interface CursorPage<T> {
  data: T[];
  page: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

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
