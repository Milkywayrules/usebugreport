import { createServiceLogger } from "@usebugreport/telemetry";
import { Elysia } from "elysia";
import { evlog } from "evlog/elysia";

export function initApiLogger(): void {
  createServiceLogger({
    environment: process.env.NODE_ENV ?? "development",
    service: "usebugreport-api",
  });
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
