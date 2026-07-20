/** Routes zero-org authenticated users may access without redirect to `/onboarding`. */
export const ONBOARDING_ALLOWLIST = [
  "/login",
  "/auth/callback",
  "/onboarding",
] as const;

const PUBLIC_UNAUTHENTICATED_PATHS = ["/login", "/auth/callback"] as const;

const STATIC_PREFIXES = ["/_next", "/favicon.ico"] as const;

const STATIC_FILE_PATTERN = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/;

export function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_FILE_PATTERN.test(pathname);
}

export function isPublicUnauthenticatedPath(pathname: string): boolean {
  return PUBLIC_UNAUTHENTICATED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isOnboardingAllowlistedPath(pathname: string): boolean {
  return ONBOARDING_ALLOWLIST.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/** Protected segments per architecture §6 — workspace and settings routes. */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  if (pathname.startsWith("/w/")) {
    return true;
  }
  if (pathname.startsWith("/settings/")) {
    return true;
  }
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return true;
  }
  return false;
}

export function hasWorkspaceMembership(
  organizations: unknown[] | null | undefined
): boolean {
  return (organizations ?? []).length > 0;
}

export function shouldRedirectToLogin(options: {
  authenticated: boolean;
  path: string;
}): boolean {
  if (options.authenticated) {
    return false;
  }
  if (isStaticAssetPath(options.path)) {
    return false;
  }
  if (isPublicUnauthenticatedPath(options.path)) {
    return false;
  }
  return isProtectedPath(options.path);
}

export function shouldRedirectToOnboarding(options: {
  authenticated: boolean;
  orgCount: number;
  path: string;
}): boolean {
  if (!options.authenticated) {
    return false;
  }
  if (isStaticAssetPath(options.path)) {
    return false;
  }
  if (options.orgCount > 0) {
    return false;
  }
  if (isOnboardingAllowlistedPath(options.path)) {
    return false;
  }
  return isProtectedPath(options.path);
}
