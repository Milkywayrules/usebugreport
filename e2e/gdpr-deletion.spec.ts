import { expect, test } from "@playwright/test";
import { createSessionFixture } from "./fixtures/session";

test.describe("GDPR workspace deletion UX", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test("owner enqueues deletion and sees in-progress status", async ({ context, page }) => {
    const fixture = await createSessionFixture({
      orgSlug: "gdpr-org",
      withOrganization: true,
    });

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/w/gdpr-org/settings/danger");
    await expect(page.getByRole("heading", { name: /danger zone/i })).toBeVisible();

    await page.getByTestId("open-delete-workspace").click();
    await page.getByTestId("confirm-slug-input").fill("gdpr-org");
    await page.getByTestId("confirm-delete-workspace").click();

    await expect(page.getByTestId("deletion-in-progress-banner")).toBeVisible({
      timeout: 20_000,
    });

    const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3101";
    const statusResponse = await page.request.get(
      `http://127.0.0.1:${apiPort}/api/v1/workspaces/${org_e2e_gate}/deletion-status`,
      { headers: { cookie: `${fixture.cookieName}=${fixture.cookieValue}` } }
    );
    expect(statusResponse.ok()).toBeTruthy();
    const statusBody = (await statusResponse.json()) as {
      data: { status: string; lastCompletedStep: string | null };
    };
    expect(statusBody.data.status).not.toBe("none");
    expect(statusBody.data.lastCompletedStep).toBeTruthy();
  });
});
