import { parseEnv } from "@usebugreport/config";
import type { Worker } from "bullmq";
import { createIngestFinalizeWorker } from "./jobs/ingest";
import { createIntegrationsWorker } from "./jobs/integrations";
import { createRetentionSweepWorker } from "./jobs/retention";
import { readProcessRssBytes, resolveWorkerConcurrency } from "./ops/concurrency";
import { logWorkerEvent } from "./ops/logger";
import { closeWorkersGracefully } from "./ops/shutdown";

export interface WorkerBundle {
  ingestWorker: Worker;
  integrationsWorker: Worker;
  retentionWorker: Worker;
}

function jobContextFromData(data: unknown): {
  organizationId?: string;
  reportId?: string;
  traceId?: string;
} {
  if (!data || typeof data !== "object") {
    return {};
  }
  const record = data as Record<string, unknown>;
  return {
    organizationId:
      typeof record.organizationId === "string"
        ? record.organizationId
        : undefined,
    reportId:
      typeof record.reportId === "string" ? record.reportId : undefined,
    traceId: typeof record.traceId === "string" ? record.traceId : undefined,
  };
}

function attachWorkerLogging(worker: Worker): void {
  worker.on("failed", (job, error) => {
    const ctx = jobContextFromData(job?.data);
    logWorkerEvent({
      err: error,
      message: `${worker.name} job failed`,
      organizationId: ctx.organizationId,
      reportId: ctx.reportId,
      traceId: ctx.traceId,
    });
  });
}

export function bootWorker(): WorkerBundle {
  const env = parseEnv(process.env);
  const ingestConcurrency = resolveWorkerConcurrency(env);
  const rssMb = Math.round(readProcessRssBytes() / (1024 * 1024));
  logWorkerEvent({
    message: "worker boot",
    traceId: `boot_${Date.now()}`,
  });
  console.log(
    JSON.stringify({
      configuredConcurrency: env.WORKER_CONCURRENCY,
      effectiveIngestConcurrency: ingestConcurrency,
      level: "info",
      memoryLimitMb: env.WORKER_MEMORY_LIMIT_MB,
      msg: "worker concurrency resolved",
      rssMb,
      service: "worker",
    })
  );

  const ingestWorker = createIngestFinalizeWorker();
  const integrationsWorker = createIntegrationsWorker();
  const retentionWorker = createRetentionSweepWorker();
  attachWorkerLogging(ingestWorker);
  attachWorkerLogging(integrationsWorker);
  attachWorkerLogging(retentionWorker);

  for (const worker of [ingestWorker, integrationsWorker, retentionWorker]) {
    worker.on("error", (error: Error) => {
      logWorkerEvent({
        err: error,
        message: "worker connection error",
      });
    });
  }

  return { ingestWorker, integrationsWorker, retentionWorker };
}

let shutdownStarted = false;

export async function shutdownWorkers(
  bundle: WorkerBundle,
  drainTimeoutMs: number
): Promise<void> {
  if (shutdownStarted) {
    return;
  }
  shutdownStarted = true;
  logWorkerEvent({ message: "worker shutdown started" });
  await closeWorkersGracefully(
    [bundle.ingestWorker, bundle.integrationsWorker, bundle.retentionWorker],
    drainTimeoutMs
  );
  logWorkerEvent({ message: "worker shutdown complete" });
}

if (import.meta.main) {
  const env = parseEnv(process.env);
  const bundle = bootWorker();
  console.log(
    `ingest.finalize worker listening on queue "${bundle.ingestWorker.name}"`
  );
  console.log(
    `integrations.linear_push worker listening on queue "${bundle.integrationsWorker.name}"`
  );
  console.log(
    `retention.sweep worker listening on queue "${bundle.retentionWorker.name}"`
  );

  const onSignal = () => {
    void shutdownWorkers(bundle, env.WORKER_DRAIN_TIMEOUT_MS)
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        logWorkerEvent({
          err: error instanceof Error ? error : new Error(String(error)),
          message: "worker shutdown failed",
        });
        process.exit(1);
      });
  };

  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
}
