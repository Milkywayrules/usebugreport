import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Api process env validated at startup (complements `@usebugreport/config`). */
export const runtimeEnv = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    OTEL_SERVICE_NAME: z.string().min(1).default("usebugreport-api"),
    PORT: z.coerce.number().int().positive().default(3001),
  },
});
