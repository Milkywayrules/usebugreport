import { expect, test } from "@playwright/test";
import {
  createProjectRbacFixture,
  ensureProjectMember,
} from "./fixtures/project-rbac";

test.describe("project RBAC", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("admin manages members and viewer loses admin controls", async ({
    browser,
    page,
  }) => {
    const fixture = await createProjectRbacFixture();

    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.admin.cookieName,
        path: "/",
        value: fixture.admin.cookieValue,
      },
    ]);
    const adminPage = await adminContext.newPage();

    await adminPage.goto(
      `/w/${fixture.workspaceSlug}/projects/${fixture.projectId}`
    );
    await expect(adminPage.getByTestId("project-members-table")).toBeVisible();
    await adminPage.getByTestId("add-project-member-btn").click();
    await adminPage.getByTestId("add-member-select").click();
    await adminPage
      .locator("[role='option']")
      .filter({ hasText: "Viewer User" })
      .click();
    await adminPage.getByTestId("submit-add-member").click();
    await adminPage.waitForTimeout(1_000);
    await adminPage.reload();
    await expect(
      adminPage.getByTestId("project-member-user_rbac_viewer")
    ).toBeVisible({ timeout: 15_000 });

    await adminContext.close();

    await ensureProjectMember(
      fixture.projectId,
      fixture.viewer.userId,
      "viewer"
    );

    const viewerContext = await browser.newContext();
    await viewerContext.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.viewer.cookieName,
        path: "/",
        value: fixture.viewer.cookieValue,
      },
    ]);
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(
      `/w/${fixture.workspaceSlug}/projects/${fixture.projectId}`
    );
    await expect(viewerPage.getByRole("heading", { name: "Platform" })).toBeVisible();
    await expect(viewerPage.getByTestId("rotate-ingest-key")).toHaveCount(0);
    await expect(viewerPage.getByTestId("delete-project")).toHaveCount(0);
    await expect(viewerPage.getByTestId("project-members-table")).toHaveCount(0);
    await viewerContext.close();

    await ensureProjectMember(
      fixture.projectId,
      fixture.viewer.userId,
      "reporter"
    );

    const reporterContext = await browser.newContext();
    await reporterContext.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.viewer.cookieName,
        path: "/",
        value: fixture.viewer.cookieValue,
      },
    ]);
    const reporterPage = await reporterContext.newPage();
    await reporterPage.goto(
      `/w/${fixture.workspaceSlug}/projects/${fixture.projectId}`
    );
    await expect(reporterPage.getByTestId("rotate-ingest-key")).toHaveCount(0);
    await reporterContext.close();

    await ensureProjectMember(
      fixture.projectId,
      fixture.viewer.userId,
      "admin"
    );

    const promotedContext = await browser.newContext();
    await promotedContext.addCookies([
      {
        domain: "127.0.0.1",
        name: fixture.viewer.cookieName,
        path: "/",
        value: fixture.viewer.cookieValue,
      },
    ]);
    const promotedPage = await promotedContext.newPage();
    await promotedPage.goto(
      `/w/${fixture.workspaceSlug}/projects/${fixture.projectId}`
    );
    await expect(promotedPage.getByTestId("project-members-table")).toBeVisible();
    await expect(promotedPage.getByTestId("rotate-ingest-key")).toBeVisible();
    await promotedContext.close();
  });
});
