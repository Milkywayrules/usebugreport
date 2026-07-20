import { opentelemetry } from "@elysiajs/opentelemetry";
import { Elysia } from "elysia";

function isOtelEnabled(): boolean {
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim());
}

function isDevConsoleSpanDumpEnabled(): boolean {
  return (
    process.env.OTEL_CONSOLE_SPANS === "1" ||
    process.env.OTEL_CONSOLE_SPANS === "true"
  );
}

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
