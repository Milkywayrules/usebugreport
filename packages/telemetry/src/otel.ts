let shutdownHook: (() => Promise<void>) | null = null;

export function isOtelEnabled(): boolean {
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim());
}

export function isDevConsoleSpanDumpEnabled(): boolean {
  return (
    process.env.OTEL_CONSOLE_SPANS === "1" ||
    process.env.OTEL_CONSOLE_SPANS === "true"
  );
}

export async function initTelemetry(): Promise<void> {
  if (!isOtelEnabled()) {
    return;
  }
  // Elysia OpenTelemetry plugin owns exporter wiring in API; worker uses no-op until OTLP collector is configured.
}

export async function shutdownTelemetry(): Promise<void> {
  if (!shutdownHook) {
    return;
  }
  await shutdownHook();
  shutdownHook = null;
}

export function registerTelemetryShutdown(hook: () => Promise<void>): void {
  shutdownHook = hook;
}
