import { expect, test } from "@playwright/test";
import { createSessionFixture } from "./fixtures/session";

test.describe("api key management", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("org admin creates, shows once, rotates, and revokes api key", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture({
      orgSlug: "acme",
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

    await page.goto("/w/acme/settings/api-keys");
    await expect(page.getByRole("heading", { name: /api keys/i })).toBeVisible();
    await expect(page.getByTestId("api-keys-table")).toBeVisible();

    await page.getByTestId("create-api-key-btn").click();
    await page.getByTestId("api-key-name-input").fill("E2E Agent");
    await page.getByTestId("submit-create-api-key").click();

    await expect(
      page.getByRole("dialog", { name: /save your api key/i })
    ).toBeVisible({ timeout: 15_000 });
    const plaintext = await page.getByTestId("api-key-plaintext-once").innerText();
    expect(plaintext).toContain("ubr_live_");
    await expect(page.getByTestId("copy-api-key-once")).toBeVisible();

    await page.getByTestId("dismiss-api-key-once").click();
    await expect(
      page.getByRole("dialog", { name: /save your api key/i })
    ).not.toBeVisible();

    const row = page.locator("[data-testid^='api-key-row-']").first();
    await expect(row).toBeVisible();
    await expect(row.locator("[data-testid^='api-key-prefix-']")).toContainText(
      plaintext.slice(-8)
    );
    await expect(row.getByText("reports:read")).toBeVisible();
    await expect(row.getByText("mcp:tools")).toBeVisible();

    const keyId = (await row.getAttribute("data-testid"))!.replace(
      "api-key-row-",
      ""
    );

    await page.getByTestId(`rotate-api-key-${keyId}`).click();
    await page.getByRole("button", { name: "Rotate key" }).click();
    await expect(
      page.getByRole("dialog", { name: /save your api key/i })
    ).toBeVisible();
    const rotatedPlaintext = await page
      .getByTestId("api-key-plaintext-once")
      .innerText();
    expect(rotatedPlaintext).toContain("ubr_live_");
    expect(rotatedPlaintext).not.toEqual(plaintext);
    await page.getByTestId("dismiss-api-key-once").click();

    const rotatedRow = page.locator("[data-testid^='api-key-row-']").first();
    await expect(rotatedRow).toBeVisible();
    const rotatedKeyId = (await rotatedRow.getAttribute("data-testid"))!.replace(
      "api-key-row-",
      ""
    );
    expect(rotatedKeyId).not.toEqual(keyId);

    await page.getByTestId(`revoke-api-key-${rotatedKeyId}`).click();
    await page.getByRole("button", { name: "Revoke key" }).click();
    await expect(
      page.locator(`[data-testid='api-key-row-${rotatedKeyId}']`)
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
