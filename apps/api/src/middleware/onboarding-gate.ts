import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { getEnv } from "../lib/env";
import type { SessionContext } from "./session";

const EXEMPT_PATHS = new Set([
  "/api/v1/session",
  "/api/v1/onboarding/workspace",
]);

export function isApiOnboardingGateExempt(pathname: string): boolean {
  return EXEMPT_PATHS.has(pathname);
}

export function shouldApiRedirectToOnboarding(options: {
  authenticated: boolean;
  orgCount: number;
  pathname: string;
}): boolean {
  if (!options.pathname.startsWith("/api/v1/")) {
    return false;
  }
  if (isApiOnboardingGateExempt(options.pathname)) {
    return false;
  }
  if (!options.authenticated) {
    return false;
  }
  return options.orgCount === 0;
}

export const onboardingGateMiddleware = new Elysia({
  name: "onboarding-gate-middleware",
}).onBeforeHandle({ as: "global" }, async (context) => {
  const { pathname } = new URL(context.request.url);
  const { session, user } = context as typeof context & {
    session: SessionContext["session"] | null;
    user: SessionContext["user"] | null;
  };

  if (!pathname.startsWith("/api/v1/")) {
    return;
  }

  if (isApiOnboardingGateExempt(pathname)) {
    return;
  }

  if (!(user && session)) {
    return;
  }

  const organizations = await (
    auth.api as unknown as {
      listOrganizations: (input: {
        headers: Headers;
      }) => Promise<unknown[] | null>;
    }
  ).listOrganizations({
    headers: context.request.headers,
  });

  const orgCount = (organizations ?? []).length;

  if (
    shouldApiRedirectToOnboarding({
      authenticated: true,
      orgCount,
      pathname,
    })
  ) {
    const env = getEnv();
    return new Response(null, {
      headers: { Location: `${env.APP_URL}/onboarding` },
      status: 302,
    });
  }
});
