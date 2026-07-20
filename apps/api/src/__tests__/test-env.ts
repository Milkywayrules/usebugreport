export const testDatabaseUrl =
  "postgresql://test:test@127.0.0.1:5432/usebugreport_test";

export const testEnvDefaults = {
  API_URL: "http://localhost:3001",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-better-auth-secret-min-32-characters",
  ENCRYPTION_KEY: "test-encryption-key-32-characters-min",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  LINEAR_CLIENT_ID: "test-linear-client-id",
  LINEAR_CLIENT_SECRET: "test-linear-client-secret",
  R2_ACCESS_KEY_ID: "test",
  R2_ACCOUNT_ID: "test",
  R2_BUCKET: "test",
  R2_SECRET_ACCESS_KEY: "test",
  REDIS_URL: "redis://localhost:6379",
} as const;

export function applyTestEnv(): void {
  if (process.env.RESEND_API_KEY === "") {
    delete process.env.RESEND_API_KEY;
  }

  for (const [key, value] of Object.entries(testEnvDefaults)) {
    process.env[key] ??= value;
  }
}

/** Integration tests run only when RUN_INTEGRATION_TESTS=1 and DATABASE_URL is set. */
export function hasDatabaseUrl(): boolean {
  if (process.env.RUN_INTEGRATION_TESTS !== "1") {
    return false;
  }

  return Boolean(process.env.DATABASE_URL?.trim());
}
