import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { sql } from "drizzle-orm";
import {
  isApiOnboardingGateExempt,
  shouldApiRedirectToOnboarding,
} from "../middleware/onboarding-gate";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = hasDatabaseUrl() ? describe : describe.skip;

describe("onboarding gate predicates", () => {
  test("session probe is exempt from API gate", () => {
    expect(isApiOnboardingGateExempt("/api/v1/session")).toBe(true);
    expect(isApiOnboardingGateExempt("/api/v1/onboarding/workspace")).toBe(
      true
    );
  });

  test("zero-org authenticated API route should redirect", () => {
    expect(
      shouldApiRedirectToOnboarding({
        authenticated: true,
        orgCount: 0,
        pathname: "/api/v1/protected-probe",
      })
    ).toBe(true);
  });

  test("org member passes API gate", () => {
    expect(
      shouldApiRedirectToOnboarding({
        authenticated: true,
        orgCount: 1,
        pathname: "/api/v1/protected-probe",
      })
    ).toBe(false);
  });

  test("unauthenticated requests defer to session middleware", () => {
    expect(
      shouldApiRedirectToOnboarding({
        authenticated: false,
        orgCount: 0,
        pathname: "/api/v1/protected-probe",
      })
    ).toBe(false);
  });
});

runIntegration("onboarding gate integration", () => {
  let app: typeof import("../index").app;
  let auth: typeof import("../lib/auth").auth;
  let db: typeof import("../lib/auth").db;
  let sessionTable: typeof import("@usebugreport/db").schema.session;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;
  let memberTable: typeof import("@usebugreport/db").schema.member;

  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    applyTestEnv();

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ auth, db } = authMod);
    const dbModule = await import("@usebugreport/db");
    sessionTable = dbModule.schema.session;
    userTable = dbModule.schema.user;
    organizationTable = dbModule.schema.organization;
    memberTable = dbModule.schema.member;

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

  async function createSessionFixture(options?: { token?: string }) {
    const userId = "user_gate_test";
    const sessionId = "session_gate_test";
    const token = options?.token ?? "session-token-gate-test-123456789";

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "gate@example.com",
      emailVerified: true,
      id: userId,
      name: "Gate Test User",
      updatedAt: new Date(),
    });

    await db.insert(sessionTable).values({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: sessionId,
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

  test("zero-org session probe stays 200", async () => {
    const { token } = await createSessionFixture();
    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/session", {
        headers: await sessionCookieHeaders(token),
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
  });

  test("zero-org protected route redirects to onboarding", async () => {
    const { token } = await createSessionFixture();
    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/protected-probe", {
        headers: await sessionCookieHeaders(token),
        method: "GET",
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/onboarding"
    );
  });

  test("org member protected route returns 200", async () => {
    const { token, userId } = await createSessionFixture();

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_gate_test",
      name: "Acme",
      slug: "acme",
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_gate_test",
      organizationId: "org_gate_test",
      role: "owner",
      userId,
    });

    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/protected-probe", {
        headers: await sessionCookieHeaders(token),
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
