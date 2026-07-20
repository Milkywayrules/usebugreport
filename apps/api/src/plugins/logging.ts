import { Elysia } from "elysia";
import { initLogger } from "evlog";
import { evlog } from "evlog/elysia";

const PRESIGNED_SIGNATURE_PATTERN = /X-Amz-Signature=/i;
const PRESIGNED_CREDENTIAL_PATTERN = /X-Amz-Credential=/i;
const SIG_QUERY_PATTERN = /sig=/i;
const TOKEN_QUERY_PATTERN = /token=[^&\s]+/i;

let loggerInitialized = false;

export function initApiLogger(): void {
  if (loggerInitialized) {
    return;
  }

  initLogger({
    env: {
      environment: process.env.NODE_ENV ?? "development",
      service: "usebugreport-api",
    },
    redact: {
      paths: [
        "authorization",
        "headers.authorization",
        "headers.cookie",
        "ingestKey",
        "ingestKeyPlaintext",
        "r2Key",
        "presignedUrl",
        "url",
      ],
      patterns: [
        PRESIGNED_SIGNATURE_PATTERN,
        PRESIGNED_CREDENTIAL_PATTERN,
        SIG_QUERY_PATTERN,
        TOKEN_QUERY_PATTERN,
      ],
    },
  });

  loggerInitialized = true;
}

interface RequestContext {
  log?: { set: (fields: Record<string, unknown>) => void };
  requestId: string;
}

export const loggingPlugin = new Elysia({ name: "logging" })
  .use(
    evlog({
      exclude: ["/health"],
    })
  )
  .onBeforeHandle({ as: "global" }, (context) => {
    const { log, requestId } = context as typeof context & RequestContext;
    log?.set({ requestId });
  });
