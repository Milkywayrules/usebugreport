import { z } from "zod";

const urlSchema = z.string().url();

export const envSchema = z.object({
  API_URL: urlSchema,
  APP_URL: urlSchema,
  BETTER_AUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  LINEAR_CLIENT_ID: z.string().min(1),
  LINEAR_CLIENT_SECRET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(8),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  return envSchema.parse(input);
}
