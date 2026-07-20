import { expect, test } from "@playwright/test";
import { createReportListBulkFixture } from "./fixtures/report-list-seed";

test.describe("bulk status change", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("updates status for three selected reports", async ({ context, page }) => {
    const fixture = await createReportListBulkFixture();

    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.cookieName,
        path: "/",
        value: fixture.cookieValue,
      },
    ]);

    await page.goto("/w/acme/reports");
    await page.getByRole("grid", { name: "Reports table" }).focus();

    await page.keyboard.press("Shift+X");
    await expect(page.getByTestId("bulk-status-bar")).toBeVisible();

    await page.getByRole("button", { name: "Change status" }).click();
    await page.getByRole("menuitem", { name: "Resolved" }).click();

    for (const id of fixture.reportIds) {
      await expect(page.getByTestId(`report-status-${id}`)).toHaveText(
        "resolved"
      );
    }
  });
});
