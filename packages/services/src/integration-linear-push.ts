import type { DbClient } from "@usebugreport/db";
import {
  integrationOperations,
  integrations,
  projects,
  reports,
} from "@usebugreport/db";
import type { IntegrationsLinearPushPayload } from "@usebugreport/queue";
import { and, eq } from "drizzle-orm";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { ServiceError } from "./types";
import { organization } from "@usebugreport/db";

export const LINEAR_PUSH_ACTION = "linear.push";

export interface LinearPushDeps {
  appUrl: string;
  enqueueLinearPush?: (payload: IntegrationsLinearPushPayload) => Promise<void>;
}

export interface LinearPushInternals {
  ensureFreshAccessToken: (integrationId: string) => Promise<string>;
  rbac: {
    canPerform: (
      ctx: AuthContext,
      projectId: string,
      action: "linear:push"
    ) => Promise<boolean>;
  };
  readActiveLinear: (
    organizationId: string
  ) => Promise<typeof integrations.$inferSelect | undefined>;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function excerptConsole(summaryText: string | null): string {
  if (!summaryText?.trim()) {
    return "_No console excerpt captured._";
  }
  const trimmed = summaryText.trim();
  return trimmed.length > 4000 ? `${trimmed.slice(0, 4000)}…` : trimmed;
}

function buildIssueDescription(input: {
  appUrl: string;
  organizationSlug: string;
  report: {
    description: string | null;
    id: string;
    summaryText: string | null;
    title: string;
  };
}): string {
  const reportUrl = `${input.appUrl.replace(/\/$/, "")}/w/${input.organizationSlug}/reports/${input.report.id}`;
  const parts = [
    input.report.description?.trim() || "_No description provided._",
    "",
    `**Report:** ${reportUrl}`,
    "",
    "**Console excerpt**",
    excerptConsole(input.report.summaryText),
  ];
  return parts.join("\n");
}

async function createLinearIssue(input: {
  accessToken: string;
  description: string;
  teamId: string;
  title: string;
}): Promise<{ id: string; url: string }> {
  const response = await fetch("https://api.linear.app/graphql", {
    body: JSON.stringify({
      query: `mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id url }
        }
      }`,
      variables: {
        input: {
          description: input.description,
          teamId: input.teamId,
          title: input.title,
        },
      },
    }),
    headers: {
      Authorization: input.accessToken,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new ServiceError("VALIDATION_ERROR", "Linear issue create failed.");
  }

  const body = (await response.json()) as {
    data?: {
      issueCreate?: {
        issue?: { id: string; url: string };
        success?: boolean;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  const issue = body.data?.issueCreate?.issue;
  if (!body.data?.issueCreate?.success || !issue?.id || !issue.url) {
    const message =
      body.errors?.[0]?.message ?? "Linear issue create returned no issue.";
    throw new ServiceError("VALIDATION_ERROR", message);
  }

  return issue;
}

export function createLinearPushHandlers(
  db: DbClient,
  deps: LinearPushDeps,
  internals: LinearPushInternals
) {
  async function readOperationByReport(reportId: string) {
    return db.query.integrationOperations.findFirst({
      where: and(
        eq(integrationOperations.reportId, reportId),
        eq(integrationOperations.action, LINEAR_PUSH_ACTION)
      ),
    });
  }

  return {
    async processLinearPushJob(operationId: string): Promise<void> {
      const operation = await db.query.integrationOperations.findFirst({
        where: eq(integrationOperations.id, operationId),
      });
      if (!operation) {
        throw new ServiceError("NOT_FOUND", "Integration operation not found.");
      }
      if (operation.status === "succeeded") {
        return;
      }
      if (operation.status !== "pending") {
        throw new ServiceError(
          "CONFLICT",
          "Integration operation is not pending."
        );
      }

      const report = await db.query.reports.findFirst({
        where: eq(reports.id, operation.reportId),
      });
      if (!report) {
        throw new ServiceError("NOT_FOUND", "Report not found.");
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, report.projectId),
      });
      if (!project) {
        throw new ServiceError("NOT_FOUND", "Project not found.");
      }

      const integration = await internals.readActiveLinear(
        operation.organizationId
      );
      if (!integration) {
        throw new ServiceError("NOT_FOUND", "Linear is not connected.");
      }

      const teamId = project.defaultLinearTeamId;
      if (!teamId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Project default Linear team is not configured."
        );
      }

      const org = await db.query.organization.findFirst({
        columns: { slug: true },
        where: eq(organization.id, operation.organizationId),
      });
      if (!org) {
        throw new ServiceError("NOT_FOUND", "Organization not found.");
      }

      try {
        const accessToken = await internals.ensureFreshAccessToken(
          integration.id
        );
        const issue = await createLinearIssue({
          accessToken,
          description: buildIssueDescription({
            appUrl: deps.appUrl,
            organizationSlug: org.slug,
            report,
          }),
          teamId,
          title: `[UBR] ${report.title}`,
        });

        await db.transaction(async (tx) => {
          await tx
            .update(integrationOperations)
            .set({
              externalId: issue.id,
              externalUrl: issue.url,
              status: "succeeded",
              updatedAt: new Date(),
            })
            .where(eq(integrationOperations.id, operationId));

          await tx
            .update(reports)
            .set({
              linearIssueId: issue.id,
              linearIssueUrl: issue.url,
              updatedAt: new Date(),
            })
            .where(eq(reports.id, report.id));
        });
      } catch (error) {
        const message =
          error instanceof ServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Linear push failed.";
        await db
          .update(integrationOperations)
          .set({
            error: message,
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(integrationOperations.id, operationId));
        throw error;
      }
    },

    async pushReportToLinear(
      ctx: AuthContext,
      reportId: string
    ): Promise<{
      externalUrl?: string;
      operationId: string;
      status: "pending" | "succeeded";
    }> {
      const report = await db.query.reports.findFirst({
        where: and(
          eq(reports.id, reportId),
          eq(reports.organizationId, ctx.organizationId)
        ),
      });
      if (!report) {
        throw new ServiceError("NOT_FOUND", "Report not found.");
      }

      const allowed = await internals.rbac.canPerform(
        ctx,
        report.projectId,
        "linear:push"
      );
      if (!allowed) {
        throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
      }

      const integration = await internals.readActiveLinear(ctx.organizationId);
      if (!integration) {
        throw new ServiceError("NOT_FOUND", "Linear is not connected.");
      }

      const operationId = generatePrefixedId("iop");
      try {
        await db.insert(integrationOperations).values({
          action: LINEAR_PUSH_ACTION,
          id: operationId,
          organizationId: ctx.organizationId,
          reportId,
          status: "pending",
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        const existing = await readOperationByReport(reportId);
        if (!existing) {
          throw error;
        }
        if (existing.status === "succeeded" && existing.externalUrl) {
          return {
            externalUrl: existing.externalUrl,
            operationId: existing.id,
            status: "succeeded",
          };
        }
        if (existing.status === "pending") {
          return { operationId: existing.id, status: "pending" };
        }
        throw new ServiceError(
          "CONFLICT",
          "Linear push previously failed. Explicit retry is required."
        );
      }

      if (!deps.enqueueLinearPush) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Linear push queue is not configured."
        );
      }

      const payload: IntegrationsLinearPushPayload = {
        operationId,
        organizationId: ctx.organizationId,
        reportId,
      };
      await deps.enqueueLinearPush(payload);

      return { operationId, status: "pending" };
    },
  };
}
