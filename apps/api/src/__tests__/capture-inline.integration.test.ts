import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import {
  createQueue,
  ingestFinalizePayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
} from "@usebugreport/queue";
import { eq, sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const putObjectCalls: Array<{
  contentType: string;
  key: string;
  size: number;
}> = [];

mock.module("@usebugreport/storage", () => ({
  createR2Client: () => ({
    bucket: "test-bucket",
    client: {},
    presignGet: (key: string) =>
      Promise.resolve(`https://r2.test/${encodeURIComponent(key)}`),
    presignPut: (key: string, contentType: string) =>
      Promise.resolve(
        `https://r2.test/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}`
      ),
    putObject: (key: string, body: Uint8Array, contentType: string) => {
      putObjectCalls.push({
        contentType,
        key,
        size: body.byteLength,
      });
      return Promise.resolve();
    },
  }),
  presignGet: () => Promise.resolve("https://signed.example/url"),
  presignPut: () => Promise.resolve("https://signed.example/url"),
  putObject: () => Promise.resolve(),
}));

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL?.trim();
const runIntegration = hasDatabaseUrl() && redisUrl ? describe : describe.skip;

const requestIdPattern = /^req_/;

function gzipPart(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/gzip" });
}

function buildInlineFormData(options?: {
  extraReplayBytes?: number;
  includeScreenshot?: boolean;
}): FormData {
  const form = new FormData();
  form.append("title", "Inline SDK capture");
  form.append("description", "from integration test");
  form.append("replaySeq", "0");
  form.append(
    "replay",
    gzipPart([
      1,
      2,
      3,
      ...(options?.extraReplayBytes
        ? new Array(options.extraReplayBytes).fill(0)
        : []),
    ]),
    "replay.json.gz"
  );
  form.append("console", gzipPart([4, 5]), "console.json.gz");
  form.append("network", gzipPart([6, 7]), "network.json.gz");
  form.append(
    "meta",
    new Blob([JSON.stringify({ version: 1 })], { type: "application/json" }),
    "meta.json"
  );
  if (options?.includeScreenshot) {
    form.append(
      "screenshot",
      new Blob([9, 8, 7], { type: "image/webp" }),
      "screenshot.webp"
    );
  }
  return form;
}

runIntegration("capture inline ingest integration", () => {
  let app: typeof import("../index").app;
  let auth: typeof import("../lib/auth").auth;
  let db: typeof import("../lib/auth").db;
  let sessionTable: typeof import("@usebugreport/db").schema.session;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let reportsTable: typeof import("@usebugreport/db").schema.reports;
  let ingestQueue: ReturnType<typeof createQueue>;

  beforeAll(async () => {
    if (!(databaseUrl && redisUrl)) {
      return;
    }

    applyTestEnv();

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ auth, db } = authMod);
    const dbModule = await import("@usebugreport/db");
    sessionTable = dbModule.schema.session;
    userTable = dbModule.schema.user;
    reportsTable = dbModule.schema.reports;

    ingestQueue = createQueue(QUEUE_NAMES.INGEST, ingestFinalizePayloadSchema);
    await ingestQueue.obliterate({ force: true });

    const { app: apiApp } = await import("../index");
    app = apiApp;
  });

  beforeEach(async () => {
    putObjectCalls.length = 0;
    const { resetMetricsForTests } = await import("../lib/metrics");
    resetMetricsForTests();

    await db.execute(sql`
      truncate table
        project_members,
        ingest_keys,
        projects,
        user_preferences,
        reports,
        report_blobs,
        workspace_usage_monthly,
        apikey,
        invitation,
        member,
        organization,
        verification,
        account,
        session,
        "user"
      restart identity cascade
    `);
    await ingestQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await ingestQueue?.close();
    await db.execute(sql`select 1`);
  });

  async function createSessionFixture(userId = "user_inline_integration") {
    const token = "session-token-inline-integration";

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "inline@example.com",
      emailVerified: true,
      id: userId,
      name: "Inline User",
      updatedAt: new Date(),
    });

    await db.insert(sessionTable).values({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: "session_inline_integration",
      token,
      updatedAt: new Date(),
      userId,
    });

    return { token, userId };
  }

  async function sessionCookieHeaders(token: string): Promise<HeadersInit> {
    const { makeSignature } = await import("better-auth/crypto");
    const ctx = await auth.$context;
    const cookieName = ctx.authCookies.sessionToken.name;
    const signedToken = `${token}.${await makeSignature(token, ctx.secret)}`;
    return { cookie: `${cookieName}=${signedToken}` };
  }

  async function seedProject() {
    const userId = "user_inline_seed";
    const { token } = await createSessionFixture(userId);
    const headers = {
      ...(await sessionCookieHeaders(token)),
      "Content-Type": "application/json",
    };

    const workspaceResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/workspaces", {
        body: JSON.stringify({ name: "Inline Org" }),
        headers,
        method: "POST",
      })
    );
    expect(workspaceResponse.status).toBe(201);
    const workspaceBody = (await workspaceResponse.json()) as {
      organization: { id: string };
    };

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: workspaceBody.organization.id })
      .where(eq(sessionTable.userId, userId));

    const createProjectResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/workspaces/${workspaceBody.organization.id}/projects`,
        {
          body: JSON.stringify({ name: "Inline SDK" }),
          headers,
          method: "POST",
        }
      )
    );

    expect(createProjectResponse.status).toBe(201);
    const projectBody = (await createProjectResponse.json()) as {
      ingestKeyPlaintext: string;
      project: { id: string };
    };

    return {
      headers,
      ingestKeyPlaintext: projectBody.ingestKeyPlaintext,
      organizationId: workspaceBody.organization.id,
      projectId: projectBody.project.id,
    };
  }

  function captureMultipartHeaders(
    ingestKeyPlaintext: string,
    idempotencyKey: string
  ): HeadersInit {
    return {
      "Idempotency-Key": idempotencyKey,
      "X-Ingest-Key": ingestKeyPlaintext,
    };
  }

  async function inlineIngestRequest(
    form: FormData,
    headers: HeadersInit
  ): Promise<Request> {
    const encoded = new Response(form);
    const contentType = encoded.headers.get("Content-Type");
    const body = await encoded.arrayBuffer();
    if (!contentType) {
      throw new Error("multipart Content-Type missing from FormData body");
    }
    return new Request("http://localhost:3001/api/v1/capture/ingest", {
      body,
      headers: {
        ...headers,
        "Content-Length": String(body.byteLength),
        "Content-Type": contentType,
      },
      method: "POST",
    });
  }

  test("multipart inline ingest uploads to R2 and enqueues refs-only job", async () => {
    const seeded = await seedProject();
    const idempotencyKey = crypto.randomUUID();
    const form = buildInlineFormData();

    const response = await app.handle(
      await inlineIngestRequest(
        form,
        captureMultipartHeaders(seeded.ingestKeyPlaintext, idempotencyKey)
      )
    );

    expect(response.status).toBe(202);
    const body = (await response.json()) as {
      durationMs: number;
      reportId: string;
      requestId: string;
      status: string;
    };
    expect(body.reportId.startsWith("rpt_")).toBe(true);
    expect(body.status).toBe("processing");
    expect(requestIdPattern.test(body.requestId)).toBe(true);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    expect(putObjectCalls.length).toBeGreaterThanOrEqual(4);

    const [reportRow] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, body.reportId));
    expect(reportRow?.ingestStatus).toBe("processing");

    const jobs = await ingestQueue.getJobs(["waiting", "delayed", "active"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe(JOB_NAMES.INGEST_FINALIZE);
    expect(ingestFinalizePayloadSchema.parse(jobs[0]?.data)).toEqual({
      idempotencyKey,
      projectId: seeded.projectId,
      r2Keys: expect.arrayContaining([
        `${seeded.organizationId}/${seeded.projectId}/${body.reportId}/replay/batch-0.json.gz`,
        `${seeded.organizationId}/${seeded.projectId}/${body.reportId}/meta.json`,
      ]),
      organizationId: organization.id,
      reportId: body.reportId,
    });

    const metricsResponse = await app.handle(
      new Request("http://localhost:3001/metrics", { method: "GET" })
    );
    expect(metricsResponse.status).toBe(200);
    const metricsBody = await metricsResponse.text();
    expect(metricsBody).toContain("ubr_ingest_duration_seconds");
    expect(metricsBody).toContain('path="inline"');
  });

  test("inline ingest over 1 MB returns 422 with presign hint", async () => {
    const seeded = await seedProject();
    const form = buildInlineFormData({ extraReplayBytes: 1_048_576 });

    const response = await app.handle(
      await inlineIngestRequest(
        form,
        captureMultipartHeaders(
          seeded.ingestKeyPlaintext,
          crypto.randomUUID()
        )
      )
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("presign");
    expect(putObjectCalls).toHaveLength(0);

    const jobs = await ingestQueue.getJobs(["waiting", "delayed", "active"]);
    expect(jobs).toHaveLength(0);
  });

  test("inline idempotency retry returns same reportId without duplicate enqueue", async () => {
    const seeded = await seedProject();
    const idempotencyKey = crypto.randomUUID();
    const headers = captureMultipartHeaders(
      seeded.ingestKeyPlaintext,
      idempotencyKey
    );

    const firstResponse = await app.handle(
      await inlineIngestRequest(buildInlineFormData(), headers)
    );
    const secondResponse = await app.handle(
      await inlineIngestRequest(buildInlineFormData(), headers)
    );

    const firstBody = (await firstResponse.json()) as { reportId: string };
    const secondBody = (await secondResponse.json()) as {
      reportId: string;
      status: string;
    };

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(202);
    expect(secondBody.reportId).toBe(firstBody.reportId);
    expect(secondBody.status).toBe("processing");

    const jobs = await ingestQueue.getJobs(["waiting", "delayed", "active"]);
    expect(jobs).toHaveLength(1);
    expect(putObjectCalls).toHaveLength(4);
  });

  test("revoked ingest key returns 401 on inline ingest", async () => {
    const seeded = await seedProject();
    const rotateResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${seeded.projectId}/ingest-keys/rotate`,
        {
          headers: seeded.headers,
          method: "POST",
        }
      )
    );
    expect(rotateResponse.status).toBe(200);

    const response = await app.handle(
      await inlineIngestRequest(
        buildInlineFormData(),
        captureMultipartHeaders(
          seeded.ingestKeyPlaintext,
          crypto.randomUUID()
        )
      )
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(requestIdPattern.test(body.error.requestId)).toBe(true);
  });

  test("non-multipart body returns 422", async () => {
    const seeded = await seedProject();

    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/capture/ingest", {
        body: JSON.stringify({ parts: [] }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "X-Ingest-Key": seeded.ingestKeyPlaintext,
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("multipart");
  });
});
