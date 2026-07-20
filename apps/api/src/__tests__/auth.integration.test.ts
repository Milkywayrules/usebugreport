import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { eq, sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const requestIdPattern = /^req_/;

interface UnauthorizedBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

interface SessionBody {
  organizations: unknown[];
  session: { token: string };
  user: { id: string };
}

if (hasDatabaseUrl()) {
  describe("auth integration", () => {
    let app: typeof import("../index").app;
    let auth: typeof import("../lib/auth").auth;
    let db: typeof import("../lib/auth").db;
    let sessionTable: typeof import("@usebugreport/db").schema.session;
    let userTable: typeof import("@usebugreport/db").schema.user;

    beforeAll(async () => {
      if (!hasDatabaseUrl()) {
        return;
      }

      applyTestEnv();

      const authMod = await import("../lib/auth");
      authMod.initAuth();
      ({ auth, db } = authMod);
      const dbModule = await import("@usebugreport/db");
      sessionTable = dbModule.schema.session;
      userTable = dbModule.schema.user;

      const { app: apiApp } = await import("../index");
      app = apiApp;
    });

    beforeEach(async () => {
      await db.execute(sql`
      truncate table
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
    });

    afterAll(async () => {
      await db.execute(sql`select 1`);
    });

    async function createSessionFixture(options?: {
      expiresAt?: Date;
      token?: string;
    }) {
      const userId = "user_test_1";
      const sessionId = "session_test_1";
      const token = options?.token ?? "session-token-test-1234567890";
      const expiresAt =
        options?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(userTable).values({
        createdAt: new Date(),
        email: "test@example.com",
        emailVerified: true,
        id: userId,
        name: "Test User",
        updatedAt: new Date(),
      });

      await db.insert(sessionTable).values({
        createdAt: new Date(),
        expiresAt,
        id: sessionId,
        token,
        updatedAt: new Date(),
        userId,
      });

      return { expiresAt, sessionId, token, userId };
    }

    async function sessionCookieHeaders(token: string): Promise<HeadersInit> {
      const { makeSignature } = await import("better-auth/crypto");
      const ctx = await auth.$context;
      const cookieName = ctx.authCookies.sessionToken.name;
      const signedToken = `${token}.${await makeSignature(token, ctx.secret)}`;
      return { cookie: `${cookieName}=${signedToken}` };
    }

    function callSessionProbe(headers: HeadersInit = {}) {
      return app.handle(
        new Request("http://localhost:3001/api/v1/session", {
          headers,
          method: "GET",
        })
      );
    }

    test("returns 401 UNAUTHORIZED without session", async () => {
      const response = await callSessionProbe();
      expect(response.status).toBe(401);

      const body = (await response.json()) as UnauthorizedBody;
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBeTruthy();
      expect(body.error.requestId).toMatch(requestIdPattern);
    });

    test("returns 200 with valid session cookie", async () => {
      const { token, userId } = await createSessionFixture();
      const response = await callSessionProbe(
        await sessionCookieHeaders(token)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as SessionBody;
      expect(body.user.id).toBe(userId);
      expect(body.session.token).toBe(token);
      expect(Array.isArray(body.organizations)).toBe(true);
    });

    test("returns 200 with bearer session token", async () => {
      const { token, userId } = await createSessionFixture();
      const response = await callSessionProbe({
        Authorization: `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as SessionBody;
      expect(body.user.id).toBe(userId);
      expect(body.session.token).toBe(token);
    });

    test("returns 401 for expired session", async () => {
      const { token } = await createSessionFixture({
        expiresAt: new Date(Date.now() - 60_000),
      });
      const response = await callSessionProbe({
        Authorization: `Bearer ${token}`,
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as UnauthorizedBody;
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("returns 401 for revoked session", async () => {
      const { sessionId, token } = await createSessionFixture();
      await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));

      const response = await callSessionProbe({
        Authorization: `Bearer ${token}`,
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as UnauthorizedBody;
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
}
