import { describe, expect, test } from "bun:test";
import {
  hasWorkspaceMembership,
  isOnboardingAllowlistedPath,
  isProtectedPath,
  shouldRedirectToLogin,
  shouldRedirectToOnboarding,
} from "./onboarding-gate";

describe("onboarding gate helpers", () => {
  describe("hasWorkspaceMembership", () => {
    test("returns false for empty org list", () => {
      expect(hasWorkspaceMembership([])).toBe(false);
      expect(hasWorkspaceMembership(null)).toBe(false);
    });

    test("returns true when orgs exist", () => {
      expect(hasWorkspaceMembership([{ id: "org_1" }])).toBe(true);
    });
  });

  describe("isProtectedPath", () => {
    test("matches workspace and settings prefixes", () => {
      expect(isProtectedPath("/")).toBe(true);
      expect(isProtectedPath("/w/acme/reports")).toBe(true);
      expect(isProtectedPath("/settings/account")).toBe(true);
      expect(isProtectedPath("/onboarding")).toBe(true);
    });

    test("does not match public auth routes", () => {
      expect(isProtectedPath("/login")).toBe(false);
      expect(isProtectedPath("/auth/callback")).toBe(false);
    });
  });

  describe("isOnboardingAllowlistedPath", () => {
    test("allows login, callback, onboarding, and workspace settings", () => {
      expect(isOnboardingAllowlistedPath("/login")).toBe(true);
      expect(isOnboardingAllowlistedPath("/onboarding")).toBe(true);
      expect(isOnboardingAllowlistedPath("/auth/callback")).toBe(true);
      expect(isOnboardingAllowlistedPath("/settings/workspaces")).toBe(true);
      expect(isOnboardingAllowlistedPath("/settings/account")).toBe(false);
    });
  });

  describe("shouldRedirectToLogin", () => {
    test("redirects unauthenticated users on protected routes", () => {
      expect(
        shouldRedirectToLogin({
          authenticated: false,
          path: "/settings/account",
        })
      ).toBe(true);
      expect(
        shouldRedirectToLogin({ authenticated: false, path: "/w/test/reports" })
      ).toBe(true);
    });

    test("does not redirect on public auth routes", () => {
      expect(
        shouldRedirectToLogin({ authenticated: false, path: "/login" })
      ).toBe(false);
      expect(
        shouldRedirectToLogin({ authenticated: false, path: "/auth/callback" })
      ).toBe(false);
    });

    test("redirects unauthenticated users away from onboarding", () => {
      expect(
        shouldRedirectToLogin({ authenticated: false, path: "/onboarding" })
      ).toBe(true);
    });
  });

  describe("shouldRedirectToOnboarding", () => {
    const allowlistCases = [
      "/login",
      "/onboarding",
      "/auth/callback",
      "/settings/workspaces",
    ] as const;

    for (const path of allowlistCases) {
      test(`does not redirect zero-org user on allowlist path ${path}`, () => {
        expect(
          shouldRedirectToOnboarding({
            authenticated: true,
            orgCount: 0,
            path,
          })
        ).toBe(false);
      });
    }

    test("redirects zero-org user on protected settings route", () => {
      expect(
        shouldRedirectToOnboarding({
          authenticated: true,
          orgCount: 0,
          path: "/settings/account",
        })
      ).toBe(true);
    });

    test("redirects zero-org user on home", () => {
      expect(
        shouldRedirectToOnboarding({
          authenticated: true,
          orgCount: 0,
          path: "/",
        })
      ).toBe(true);
    });

    test("passes when user has workspace membership", () => {
      expect(
        shouldRedirectToOnboarding({
          authenticated: true,
          orgCount: 1,
          path: "/settings/account",
        })
      ).toBe(false);
    });

    test("allows explicit revisit of onboarding with membership", () => {
      expect(
        shouldRedirectToOnboarding({
          authenticated: true,
          orgCount: 2,
          path: "/onboarding",
        })
      ).toBe(false);
    });
  });
});
