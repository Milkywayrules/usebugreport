import { opentelemetry } from "@elysiajs/opentelemetry";

import { runtimeEnv } from "../runtime-env";
import {
  isDevConsoleSpanDumpEnabled,
  isOtelEnabled,
} from "@usebugreport/telemetry";
import { Elysia } from "elysia";

export const observabilityPlugin = isOtelEnabled()
  ? new Elysia({ name: "observability" }).use(
      opentelemetry({
        serviceName: runtimeEnv.OTEL_SERVICE_NAME,
        ...(isDevConsoleSpanDumpEnabled()
          ? {
              instrumentations: [],
            }
          : {}),
      })
    )
  : new Elysia({ name: "observability-noop" });
