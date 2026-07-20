import { initLogger } from "evlog";
import { DEFAULT_REDACT_PATHS, DEFAULT_REDACT_PATTERNS } from "./redaction";

let initialized = false;

export interface ServiceLoggerOptions {
  environment?: string;
  service: string;
}

export function createServiceLogger(options: ServiceLoggerOptions): void {
  if (initialized) {
    return;
  }

  initLogger({
    env: {
      environment: options.environment ?? process.env.NODE_ENV ?? "development",
      service: options.service,
    },
    redact: {
      paths: [...DEFAULT_REDACT_PATHS],
      patterns: [...DEFAULT_REDACT_PATTERNS],
    },
  });

  initialized = true;
}
