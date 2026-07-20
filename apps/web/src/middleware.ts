import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  shouldRedirectToLogin,
  shouldRedirectToOnboarding,
} from "./lib/onboarding-gate";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface SessionProbeResponse {
  organizations?: unknown[];
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookie = request.headers.get("cookie") ?? "";
  let authenticated = false;
  let orgCount = 0;

  if (cookie) {
    try {
      const sessionResponse = await fetch(`${apiUrl}/api/v1/session`, {
        cache: "no-store",
        headers: { cookie },
      });

      if (sessionResponse.ok) {
        authenticated = true;
        const body = (await sessionResponse.json()) as SessionProbeResponse;
        orgCount = (body.organizations ?? []).length;
      }
    } catch {
      // API unavailable — treat as unauthenticated; page handlers may recover.
    }
  }

  if (
    shouldRedirectToLogin({
      authenticated,
      path: pathname,
    })
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    shouldRedirectToOnboarding({
      authenticated,
      orgCount,
      path: pathname,
    })
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/w/:path*",
    "/settings/:path*",
    "/onboarding",
    "/login",
    "/auth/:path*",
  ],
};
