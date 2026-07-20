import { defineConfig } from "@playwright/test";

const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "3100";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3101";
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://usebugreport:usebugreport@localhost:5432/usebugreport";

const apiEnv: Record<string, string> = {
  API_URL: apiBaseUrl,
  APP_URL: webBaseUrl,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    "test-better-auth-secret-min-32-characters",
  DATABASE_URL: databaseUrl,
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY ?? "test-encryption-key-32-characters-min",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "test-github-client-id",
  GITHUB_CLIENT_SECRET:
    process.env.GITHUB_CLIENT_SECRET ?? "test-github-client-secret",
  LINEAR_CLIENT_ID: process.env.LINEAR_CLIENT_ID ?? "test-linear-client-id",
  LINEAR_CLIENT_SECRET:
    process.env.LINEAR_CLIENT_SECRET ?? "test-linear-client-secret",
  PORT: apiPort,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "test",
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "test",
  R2_BUCKET: process.env.R2_BUCKET ?? "test",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "test",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
};

if (process.env.RESEND_API_KEY?.trim()) {
  apiEnv.RESEND_API_KEY = process.env.RESEND_API_KEY;
}

export default defineConfig({
  testDir: "./e2e",
  // Shared Postgres fixtures truncate auth tables; parallel workers race (E4-S3 e2e).
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: webBaseUrl,
  },
  webServer: [
    {
      command: `bash -lc "unset RESEND_API_KEY; exec bun apps/api/src/index.ts"`,
      cwd: ".",
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${apiBaseUrl}/health`,
    },
    {
      command: `bun --cwd apps/web dev --port ${webPort}`,
      env: {
        NEXT_PUBLIC_API_URL: apiBaseUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: webBaseUrl,
    },
  ],
});
