import { createDbClient, schema } from "@usebugreport/db";
import { createProjectService } from "@usebugreport/services";
import { createSessionFixture, type SessionFixture } from "./session";

const { reports } = schema;

export async function createReportListBulkFixture(): Promise<
  SessionFixture & { reportIds: string[] }
> {
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
  const projectService = createProjectService(db);
  const created = await projectService.createProject(
    { organizationId: "org_acme", type: "session", userId: fixture.userId },
    { name: "Default" }
  );

  const reportIds = ["rpt_bulk_1", "rpt_bulk_2", "rpt_bulk_3"];
  const now = new Date();

  for (const [index, id] of reportIds.entries()) {
    await db.insert(reports).values({
      createdAt: now,
      description: null,
      environment: {},
      id,
      ingestStatus: "complete",
      organizationId: "org_acme",
      projectId: created.project.id,
      reporterLabel: "E2E",
      status: "open",
      summary: {},
      summaryText: null,
      title: `Bulk fixture ${index + 1}`,
      updatedAt: now,
    });
  }

  return { ...fixture, reportIds };
}
