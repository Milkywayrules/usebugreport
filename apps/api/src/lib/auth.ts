import { apiKey } from "@better-auth/api-key";
import { createDbClient, type DbClient, schema } from "@usebugreport/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, organization } from "better-auth/plugins";
import { getEnv } from "./env";

// better-auth plugin inference is wider than ReturnType<typeof betterAuth>
export let auth: ReturnType<typeof betterAuth> = undefined as never;
export let db!: DbClient;

export function initAuth(): void {
  if (auth && db) {
    return;
  }

  const env = getEnv();
  db = createDbClient(env.DATABASE_URL);
  auth = betterAuth({
    advanced: {
      crossSubDomainCookies: {
        enabled: false,
      },
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: env.API_URL.startsWith("https"),
      },
    },
    baseURL: env.API_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    plugins: [organization(), apiKey(), bearer()],
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    trustedOrigins: [env.APP_URL],
  }) as unknown as ReturnType<typeof betterAuth>;
}
