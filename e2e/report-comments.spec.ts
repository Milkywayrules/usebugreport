import { expect, test } from "@playwright/test";
import { createDbClient, schema } from "@usebugreport/db";
import { createSessionFixture } from "./fixtures/session";

const { projectMembers, projects, reports } = schema;

test.describe("report comments", () => {
  test("reporter comment persists after reload", async ({ page, browser }) => {
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
    const projectId = "prj_e2e_comments";
    const reportId = "rpt_e2e_comments";

    await db.insert(projects).values({
      id: projectId,
      name: "Comments",
      organizationId: "org_acme",
      slug: "comments",
    });

    await db.insert(projectMembers).values({
      projectId,
      role: "reporter",
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
      title: "Comment e2e",
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
      await tab.goto(`/w/acme/reports/${reportId}`);
      await tab.getByRole("tab", { name: "Comments" }).click();
      await tab.getByTestId("report-comment-input").fill("Ship fix tonight");
      await tab.getByTestId("report-comment-submit").click();
      await expect(tab.getByText("Ship fix tonight")).toBeVisible();
      await tab.reload();
      await tab.getByRole("tab", { name: "Comments" }).click();
      await expect(tab.getByText("Ship fix tonight")).toBeVisible();
      await context.close();
    });
  });
});
