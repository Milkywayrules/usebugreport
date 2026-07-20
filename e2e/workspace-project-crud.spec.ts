import { expect, test } from "@playwright/test";
import { createSessionFixture } from "./fixtures/session";

test.describe("workspace and project CRUD", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("creates workspace, switches, creates project, rotates ingest key", async ({
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

    await page.goto("/settings/workspaces");
    await expect(page.getByRole("heading", { name: /workspaces/i })).toBeVisible();

    await page.getByTestId("create-workspace-btn").click();
    await page.getByTestId("workspace-name-input").fill("Beta Corp");
    await page.getByTestId("submit-create-workspace").click();

    await expect(page.getByTestId("workspace-row-beta-corp")).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/w/beta-corp/projects");
    await page.getByTestId("create-project-btn").click();
    await page.getByTestId("project-name-input").fill("Mobile App");
    await page.getByTestId("submit-create-project").click();

    await expect(page.getByTestId("ingest-key-once")).toBeVisible();
    const ingestKey = await page.getByTestId("ingest-key-once").innerText();
    expect(ingestKey).toContain("ubr_ingest_");

    const viewLink = page.getByRole("link", { name: "View" });
    await viewLink.click();
    await expect(page.getByRole("heading", { name: "Mobile App" })).toBeVisible();

    await page.getByTestId("rotate-ingest-key").click();
    await expect(page.getByTestId("rotated-ingest-key")).toBeVisible();
    const rotatedKey = await page.getByTestId("ingest-key-value").innerText();
    expect(rotatedKey).toContain("ubr_ingest_");
    expect(rotatedKey).not.toEqual(ingestKey);
  });

  test("shows tier error when free user attempts second workspace", async ({
    context,
    page,
  }) => {
    const fixture = await createSessionFixture({
      orgSlug: "first-ws",
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

    await page.goto("/settings/workspaces");
    await page.getByTestId("create-workspace-btn").click();
    await page.getByTestId("workspace-name-input").fill("Second Workspace");
    await page.getByTestId("submit-create-workspace").click();

    await expect(page.getByTestId("create-workspace-error")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("create-workspace-error")).toContainText(
      /limit|upgrade|workspace/i
    );
  });
});
