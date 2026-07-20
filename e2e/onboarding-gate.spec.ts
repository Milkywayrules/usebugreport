import { expect, test } from "@playwright/test";
import { createSessionFixture } from "./fixtures/session";

test.describe("onboarding gate", () => {
  test("unauthenticated protected route redirects to login", async ({ page }) => {
    await page.goto("/w/test/reports");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("zero-org session redirects protected route to onboarding", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture();

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });

  test("zero-org session can reach onboarding without redirect loop", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture();

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });

  test("org member protected route does not redirect to onboarding", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture({ withOrganization: true });

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByRole("heading", { name: /account settings/i })).toBeVisible();
  });

  test("org member can revisit onboarding explicitly", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture({ withOrganization: true });

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });
  test("onboarding skip control disabled before workspace create", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture();

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/onboarding");
    await expect(page.getByRole("button", { name: /skip to dashboard/i })).toBeDisabled();
  });

});
