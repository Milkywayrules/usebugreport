import { opentelemetry } from "@elysiajs/opentelemetry";
import {
  isDevConsoleSpanDumpEnabled,
  isOtelEnabled,
} from "@usebugreport/telemetry";
import { Elysia } from "elysia";

export const observabilityPlugin = isOtelEnabled()
  ? new Elysia({ name: "observability" }).use(
      opentelemetry({
        serviceName: process.env.OTEL_SERVICE_NAME ?? "usebugreport-api",
        ...(isDevConsoleSpanDumpEnabled()
          ? {
              instrumentations: [],
            }
          : {}),
      })
    )
  : new Elysia({ name: "observability-noop" });
