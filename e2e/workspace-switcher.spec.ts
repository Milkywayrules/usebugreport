import { expect, test } from "@playwright/test";
import { createSessionFixture } from "./fixtures/session";

async function applySessionCookie(
  context: Parameters<typeof test>[0]["context"],
  fixture: Awaited<ReturnType<typeof createSessionFixture>>
) {
  await context.addCookies([
    {
      domain: "127.0.0.1",
      name: fixture.cookieName,
      path: "/",
      value: fixture.cookieValue,
    },
  ]);
}

test.describe("workspace switcher", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("switches workspace via menu and pinned hotkey", async ({ context, page }) => {
    const fixture = await createSessionFixture({
      activeOrganizationId: "org_acme",
      organizations: [
        {
          billingTier: "pro",
          id: "org_acme",
          name: "Acme",
          slug: "acme",
        },
        {
          billingTier: "pro",
          id: "org_beta",
          name: "Beta Corp",
          slug: "beta-corp",
        },
      ],
      pinnedWorkspaceIds: ["org_acme", "org_beta"],
    });

    await applySessionCookie(context, fixture);

    await page.goto("/w/acme/reports");
    await expect(page.getByTestId("workspace-switcher")).toHaveText("Acme");

    await page.getByTestId("workspace-switcher").click();
    await page.getByRole("menuitem", { name: /Beta Corp/i }).click();

    await expect(page).toHaveURL(/\/w\/beta-corp\/reports/, { timeout: 15_000 });
    await expect(page.getByTestId("workspace-switcher")).toHaveText("Beta Corp");

    await page.keyboard.press("Control+1");
    await expect(page).toHaveURL(/\/w\/acme\/reports/, { timeout: 15_000 });
    await expect(page.getByTestId("workspace-switcher")).toHaveText("Acme");
  });
});
