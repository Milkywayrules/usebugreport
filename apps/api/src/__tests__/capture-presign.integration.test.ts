import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
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

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL?.trim();
const runIntegration = hasDatabaseUrl() && redisUrl ? describe : describe.skip;

const requestIdPattern = /^req_/;

runIntegration("capture presign and complete integration", () => {
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

  async function createSessionFixture(userId = "user_capture_integration") {
    const token = "session-token-capture-integration";

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "capture@example.com",
      emailVerified: true,
      id: userId,
      name: "Capture User",
      updatedAt: new Date(),
    });

    await db.insert(sessionTable).values({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: "session_capture_integration",
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
    const userId = "user_capture_seed";
    const { token } = await createSessionFixture(userId);
    const headers = {
      ...(await sessionCookieHeaders(token)),
      "Content-Type": "application/json",
    };

    const workspaceResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/workspaces", {
        body: JSON.stringify({ name: "Capture Org" }),
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
          body: JSON.stringify({ name: "SDK" }),
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

  function captureHeaders(
    ingestKeyPlaintext: string,
    idempotencyKey: string
  ): HeadersInit {
    return {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-Ingest-Key": ingestKeyPlaintext,
    };
  }

  test("presign then complete enqueues refs-only ingest.finalize job", async () => {
    const seeded = await seedProject();
    const idempotencyKey = crypto.randomUUID();

    const presignResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/capture/presign", {
        body: JSON.stringify({
          parts: [
            { contentType: "application/gzip", name: "replay", seq: 0 },
            { contentType: "application/json", name: "meta" },
          ],
          title: "SDK capture",
        }),
        headers: captureHeaders(seeded.ingestKeyPlaintext, idempotencyKey),
        method: "POST",
      })
    );

    expect(presignResponse.status).toBe(200);
    const presignBody = (await presignResponse.json()) as {
      reportId: string;
      requestId: string;
      uploads: Array<{ key: string; part: string; url: string }>;
    };
    expect(presignBody.reportId.startsWith("rpt_")).toBe(true);
    expect(presignBody.uploads.length).toBeGreaterThan(0);
    expect(requestIdPattern.test(presignBody.requestId)).toBe(true);

    const [reportRow] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, presignBody.reportId));
    expect(reportRow?.ingestStatus).toBe("pending");

    const completeResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/capture/complete", {
        body: JSON.stringify({
          r2Keys: presignBody.uploads.map((upload) => upload.key),
          organizationId: organization.id,
      reportId: presignBody.reportId,
        }),
        headers: captureHeaders(seeded.ingestKeyPlaintext, idempotencyKey),
        method: "POST",
      })
    );

    expect(completeResponse.status).toBe(202);
    const completeBody = (await completeResponse.json()) as {
      durationMs: number;
      reportId: string;
      status: string;
    };
    expect(completeBody.status).toBe("processing");
    expect(completeBody.durationMs).toBeLessThan(200);

    const jobs = await ingestQueue.getJobs(["waiting", "delayed", "active"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe(JOB_NAMES.INGEST_FINALIZE);
    expect(ingestFinalizePayloadSchema.parse(jobs[0]?.data)).toEqual({
      idempotencyKey,
      projectId: seeded.projectId,
      r2Keys: presignBody.uploads.map((upload) => upload.key),
      organizationId: organization.id,
      reportId: presignBody.reportId,
    });
  });

  test("presign idempotency retry returns same reportId", async () => {
    const seeded = await seedProject();
    const idempotencyKey = crypto.randomUUID();
    const headers = captureHeaders(seeded.ingestKeyPlaintext, idempotencyKey);
    const body = JSON.stringify({
      parts: [{ contentType: "application/json", name: "meta" }],
    });

    const firstResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/capture/presign", {
        body,
        headers,
        method: "POST",
      })
    );
    const secondResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/capture/presign", {
        body,
        headers,
        method: "POST",
      })
    );

    const firstBody = (await firstResponse.json()) as { reportId: string };
    const secondBody = (await secondResponse.json()) as { reportId: string };
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody.reportId).toBe(firstBody.reportId);
  });

  test("revoked ingest key returns 401 on presign", async () => {
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
      new Request("http://localhost:3001/api/v1/capture/presign", {
        body: JSON.stringify({
          parts: [{ contentType: "application/json", name: "meta" }],
        }),
        headers: captureHeaders(seeded.ingestKeyPlaintext, crypto.randomUUID()),
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(requestIdPattern.test(body.error.requestId)).toBe(true);
  });

  test("ingest key on GET /api/v1/projects returns 401", async () => {
    const seeded = await seedProject();

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${seeded.projectId}`, {
        headers: {
          "X-Ingest-Key": seeded.ingestKeyPlaintext,
        },
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Authentication required.");
  });
});
