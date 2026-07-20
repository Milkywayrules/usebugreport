/** Tags for hybrid OpenAPI filtering — only `integration-public` appears in public spec. */
export const ROUTE_TAGS = {
  authHandler: "auth-handler",
  integrationPublic: "integration-public",
  internalDev: "internal-dev",
  onboarding: "onboarding",
  ops: "ops",
  sessionBff: "session-bff",
} as const;

export type RouteTag = (typeof ROUTE_TAGS)[keyof typeof ROUTE_TAGS];

export const INTEGRATION_PUBLIC_TAG = ROUTE_TAGS.integrationPublic;

export const OPENAPI_EXCLUDED_TAGS: RouteTag[] = [
  ROUTE_TAGS.sessionBff,
  ROUTE_TAGS.onboarding,
  ROUTE_TAGS.internalDev,
  ROUTE_TAGS.ops,
  ROUTE_TAGS.authHandler,
];

export const OPENAPI_EXCLUDED_PATH_PREFIXES = [
  "/health",
  "/metrics",
  "/mcp",
  "/api/auth",
  "/api/web",
  "/api/v1/session",
  "/api/v1/onboarding",
  "/api/v1/protected-probe",
  "/api/v1/auth/context-probe",
  "/api/v1/auth/scope-probe",
] as const;

export function isExcludedOpenApiPath(path: string): boolean {
  return OPENAPI_EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
