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

export const GITHUB_PUSH_ACTION = "github.push";

export interface PushReportToGitHubOptions {
  retry?: boolean;
}

export interface GitHubPushDeps {
  appUrl: string;
  enqueueGitHubPush?: (payload: IntegrationsLinearPushPayload) => Promise<void>;
}

export interface GitHubPushInternals {
  ensureFreshAccessToken: (integrationId: string) => Promise<string>;
  rbac: {
    canPerform: (
      ctx: AuthContext,
      projectId: string,
      action: "github:push"
    ) => Promise<boolean>;
  };
  readActiveGitHub: (
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

async function createGitHubIssue(input: {
  accessToken: string;
  body: string;
  owner: string;
  repo: string;
  title: string;
}): Promise<{ id: string; url: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/issues`,
    {
      body: JSON.stringify({ body: input.body, title: input.title }),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new ServiceError("VALIDATION_ERROR", "GitHub issue create failed.");
  }

  const body = (await response.json()) as {
    html_url?: string;
    id?: number;
    message?: string;
  };

  if (!body.id || !body.html_url) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      body.message ?? "GitHub issue create returned no issue."
    );
  }

  return { id: String(body.id), url: body.html_url };
}

function parseGithubRepo(slug: string): { owner: string; repo: string } {
  const trimmed = slug.trim();
  const [owner, repo] = trimmed.split("/");
  if (!owner || !repo) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Project default GitHub repo must be owner/repo."
    );
  }
  return { owner, repo: repo.replace(/\.git$/, "") };
}

export function createGitHubPushHandlers(
  db: DbClient,
  deps: GitHubPushDeps,
  internals: GitHubPushInternals
) {
  async function readOperationByReport(reportId: string) {
    return db.query.integrationOperations.findFirst({
      where: and(
        eq(integrationOperations.reportId, reportId),
        eq(integrationOperations.action, GITHUB_PUSH_ACTION)
      ),
    });
  }

  return {
    async processGitHubPushJob(operationId: string): Promise<void> {
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

      const integration = await internals.readActiveGitHub(
        operation.organizationId
      );
      if (!integration) {
        throw new ServiceError("NOT_FOUND", "GitHub is not connected.");
      }

      const repoSlug = project.defaultGithubRepo;
      if (!repoSlug) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Project default GitHub team is not configured."
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
        const { owner, repo } = parseGithubRepo(repoSlug);
        const issue = await createGitHubIssue({
          accessToken,
          body: buildIssueDescription({
            appUrl: deps.appUrl,
            organizationSlug: org.slug,
            report,
          }),
          owner,
          repo,
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

        });
      } catch (error) {
        const message =
          error instanceof ServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : "GitHub push failed.";
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

    async pushReportToGitHub(
      ctx: AuthContext,
      reportId: string,
      options: PushReportToGitHubOptions = {}
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
        "github:push"
      );
      if (!allowed) {
        throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
      }

      const integration = await internals.readActiveGitHub(ctx.organizationId);
      if (!integration) {
        throw new ServiceError("NOT_FOUND", "GitHub is not connected.");
      }

      const operationId = generatePrefixedId("iop");
      try {
        await db.insert(integrationOperations).values({
          action: GITHUB_PUSH_ACTION,
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
        if (existing.status === "failed") {
          if (!options.retry) {
            throw new ServiceError(
              "CONFLICT",
              "GitHub push previously failed. Explicit retry is required."
            );
          }

          const flipped = await db
            .update(integrationOperations)
            .set({
              error: null,
              status: "pending",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(integrationOperations.id, existing.id),
                eq(integrationOperations.status, "failed")
              )
            )
            .returning({ id: integrationOperations.id });

          if (flipped.length === 0) {
            const again = await readOperationByReport(reportId);
            if (!again) {
              throw new ServiceError("CONFLICT", "GitHub push retry lost race.");
            }
            if (again.status === "succeeded" && again.externalUrl) {
              return {
                externalUrl: again.externalUrl,
                operationId: again.id,
                status: "succeeded",
              };
            }
            if (again.status === "pending") {
              return { operationId: again.id, status: "pending" };
            }
            throw new ServiceError(
              "CONFLICT",
              "GitHub push retry conflicted with another attempt."
            );
          }

          if (!deps.enqueueGitHubPush) {
            throw new ServiceError(
              "VALIDATION_ERROR",
              "GitHub push queue is not configured."
            );
          }

          await deps.enqueueGitHubPush({
            operationId: existing.id,
            organizationId: ctx.organizationId,
            reportId,
          });

          return { operationId: existing.id, status: "pending" };
        }
        throw new ServiceError(
          "CONFLICT",
          "GitHub push is in an unexpected state."
        );
      }

      if (!deps.enqueueGitHubPush) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "GitHub push queue is not configured."
        );
      }

      const payload: IntegrationsLinearPushPayload = {
        operationId,
        organizationId: ctx.organizationId,
        reportId,
      };
      await deps.enqueueGitHubPush(payload);

      return { operationId, status: "pending" };
    },
  };
}
