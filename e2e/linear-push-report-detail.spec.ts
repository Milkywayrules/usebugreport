import { expect, test } from "@playwright/test";
import { createDbClient, schema } from "@usebugreport/db";
import { createSessionFixture } from "./fixtures/session";

const { projectMembers, projects, reports } = schema;

test.describe("linear push ux", () => {
  test("cmd+k push shows linear issue link", async ({ page, browser }) => {
    const fixture = await createSessionFixture({
      activeOrganizationId: "org_acme",
      organizations: [
        {
          billingTier: "pro",
          id: "org_acme",
          name: "Acme",
          slug: "acme",
        },
      ],
    });

    const db = createDbClient(process.env.DATABASE_URL!);
    const projectId = "prj_e2e_linear_push";
    const reportId = "rpt_e2e_linear_push";

    await db.insert(projects).values({
      id: projectId,
      name: "Linear",
      organizationId: "org_acme",
      slug: "linear",
    });

    await db.insert(projectMembers).values({
      projectId,
      role: "developer",
      userId: fixture.userId,
    });

    await db.insert(reports).values({
      createdAt: new Date(),
      description: null,
      environment: {},
      id: reportId,
      ingestStatus: "complete",
      organizationId: "org_acme",
      projectId,
      status: "open",
      summary: {},
      summaryText: null,
      title: "Linear push e2e",
      updatedAt: new Date(),
    });

    await browser.newContext().then(async (context) => {
      await context.addCookies([
        {
          domain: "127.0.0.1",
          name: fixture.cookieName,
          path: "/",
          value: fixture.cookieValue,
        },
      ]);
      const tab = await context.newPage();
      await tab.route(`**/api/v1/reports/${reportId}/linear/push`, async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            data: {
              externalUrl: "https://linear.app/acme/issue/UBR-1",
              operationId: "iop_test",
              status: "succeeded",
            },
            requestId: "req_test",
          }),
          contentType: "application/json",
          status: 200,
        });
      });
      await tab.route(`**/api/v1/reports/${reportId}`, async (route) => {
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }
        await route.fulfill({
          body: JSON.stringify({
            data: {
              createdAt: new Date().toISOString(),
              description: null,
              environment: {},
              id: reportId,
              ingestStatus: "complete",
              linearIssueUrl: "https://linear.app/acme/issue/UBR-1",
              projectId,
              status: "open",
              summary: {},
              summaryText: null,
              title: "Linear push e2e",
              updatedAt: new Date().toISOString(),
              workspaceSlug: "acme",
            },
            requestId: "req_test",
          }),
          contentType: "application/json",
          status: 200,
        });
      });

      await tab.goto(`/w/acme/reports/${reportId}`);
      await tab.keyboard.press("Control+k");
      await tab.getByPlaceholder("Search commands").fill("Push to Linear");
      await tab.getByRole("button", { name: "Push to Linear" }).click();
      await expect(tab.getByTestId("report-linear-issue-link")).toHaveAttribute(
        "href",
        "https://linear.app/acme/issue/UBR-1"
      );
      await context.close();
    });
  });
});
