import { describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import type { AuthContext } from "./types";
import {
  GITHUB_PUSH_ACTION,
  createGitHubPushHandlers,
} from "./integration-github-push";

const ctx: AuthContext = {
  organizationId: "org_test",
  projectIds: ["proj_test"],
  requestId: "req_test",
  type: "session",
  userId: "user_test",
};

type OperationRow = {
  action: string;
  error: string | null;
  externalUrl: string | null;
  id: string;
  organizationId: string;
  reportId: string;
  status: "failed" | "pending" | "succeeded";
};

function createMockDb(initial: OperationRow | null) {
  const state: { inserts: number; op: OperationRow | null } = {
    inserts: 0,
    op: initial ? { ...initial } : null,
  };

  const db = {
    insert: () => ({
      values: () => {
        state.inserts += 1;
        if (state.op) {
          const error = new Error("unique violation") as Error & { code?: string };
          error.code = "23505";
          return Promise.reject(error);
        }
        state.op = {
          action: GITHUB_PUSH_ACTION,
          error: null,
          externalUrl: null,
          id: "iop_new",
          organizationId: ctx.organizationId,
          reportId: "rpt_test",
          status: "pending",
        };
        return Promise.resolve(undefined);
      },
    }),
    query: {
      integrationOperations: {
        findFirst: async () => state.op,
      },
      reports: {
        findFirst: async () => ({
          id: "rpt_test",
          organizationId: ctx.organizationId,
          projectId: "proj_test",
        }),
      },
    },
    update: () => ({
      set: (patch: Partial<OperationRow>) => ({
        where: () => ({
          returning: async () => {
            if (!state.op || state.op.status !== "failed") {
              return [];
            }
            state.op = {
              ...state.op,
              error: patch.error ?? null,
              status: (patch.status as OperationRow["status"]) ?? state.op.status,
            };
            return [{ id: state.op.id }];
          },
        }),
      }),
    }),
  } as unknown as DbClient;

  return { db, state };
}

const internals = {
  ensureFreshAccessToken: async () => "token",
  rbac: {
    canPerform: async () => true,
  },
  readActiveGitHub: async () => ({
    config: {},
    connectedAt: new Date(),
    id: "int_test",
    oauthTokensEncrypted: "enc_test",
    organizationId: ctx.organizationId,
    revokedAt: null,
    type: "linear" as const,
  }),
};

describe("integration linear push", () => {
  test("linear push action constant", () => {
    expect(GITHUB_PUSH_ACTION).toBe("github.push");
  });

  test("pending duplicate does not enqueue a second job", async () => {
    const mock = createMockDb({
      action: GITHUB_PUSH_ACTION,
      error: null,
      externalUrl: null,
      id: "iop_pending",
      organizationId: ctx.organizationId,
      reportId: "rpt_test",
      status: "pending",
    });

    let enqueueCount = 0;
    const handlers = createGitHubPushHandlers(
      mock.db,
      {
        appUrl: "https://app.example",
        enqueueGitHubPush: async () => {
          enqueueCount += 1;
        },
      },
      internals
    );

    const result = await handlers.pushReportToGitHub(ctx, "rpt_test");
    expect(result.status).toBe("pending");
    expect(result.operationId).toBe("iop_pending");
    expect(enqueueCount).toBe(0);
    expect(mock.state.inserts).toBe(1);
  });

  test("failed push requires explicit retry", async () => {
    const mock = createMockDb({
      action: GITHUB_PUSH_ACTION,
      error: "Linear down",
      externalUrl: null,
      id: "iop_failed",
      organizationId: ctx.organizationId,
      reportId: "rpt_test",
      status: "failed",
    });

    const handlers = createGitHubPushHandlers(
      mock.db,
      {
        appUrl: "https://app.example",
        enqueueGitHubPush: async () => undefined,
      },
      internals
    );

    await expect(handlers.pushReportToGitHub(ctx, "rpt_test")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("failed retry flips pending and enqueues once", async () => {
    const mock = createMockDb({
      action: GITHUB_PUSH_ACTION,
      error: "Linear down",
      externalUrl: null,
      id: "iop_failed",
      organizationId: ctx.organizationId,
      reportId: "rpt_test",
      status: "failed",
    });

    let enqueueCount = 0;
    const handlers = createGitHubPushHandlers(
      mock.db,
      {
        appUrl: "https://app.example",
        enqueueGitHubPush: async () => {
          enqueueCount += 1;
        },
      },
      internals
    );

    const result = await handlers.pushReportToGitHub(ctx, "rpt_test", {
      retry: true,
    });
    expect(result).toEqual({ operationId: "iop_failed", status: "pending" });
    expect(enqueueCount).toBe(1);
    expect(mock.state.op?.status).toBe("pending");
  });

  test("succeeded duplicate returns existing url without enqueue", async () => {
    const mock = createMockDb({
      action: GITHUB_PUSH_ACTION,
      error: null,
      externalUrl: "https://linear.app/issue/UBR-1",
      id: "iop_done",
      organizationId: ctx.organizationId,
      reportId: "rpt_test",
      status: "succeeded",
    });

    let enqueueCount = 0;
    const handlers = createGitHubPushHandlers(
      mock.db,
      {
        appUrl: "https://app.example",
        enqueueGitHubPush: async () => {
          enqueueCount += 1;
        },
      },
      internals
    );

    const result = await handlers.pushReportToGitHub(ctx, "rpt_test");
    expect(result.status).toBe("succeeded");
    expect(result.externalUrl).toBe("https://linear.app/issue/UBR-1");
    expect(enqueueCount).toBe(0);
  });

  test("fresh push enqueues exactly one job", async () => {
    const mock = createMockDb(null);
    let enqueueCount = 0;
    const handlers = createGitHubPushHandlers(
      mock.db,
      {
        appUrl: "https://app.example",
        enqueueGitHubPush: async () => {
          enqueueCount += 1;
        },
      },
      internals
    );

    const result = await handlers.pushReportToGitHub(ctx, "rpt_test");
    expect(result.status).toBe("pending");
    expect(enqueueCount).toBe(1);
  });
});
