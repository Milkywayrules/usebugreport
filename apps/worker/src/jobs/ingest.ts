import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createQueue,
  createRedisConnection,
  ingestFinalizePayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
  trackFinalizeJobEnd,
  trackFinalizeJobStart,
} from "@usebugreport/queue";
import {
  createCaptureIngestService,
  createUsageService,
  createWebhookService,
} from "@usebugreport/services";
import { createR2Client } from "@usebugreport/storage";
import { type Job, Worker } from "bullmq";
import { resolveWorkerConcurrency } from "../ops/concurrency";


export function createIngestFinalizeWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const usageService = createUsageService(db);
  const webhookService = createWebhookService(db, {
    encryptionKey: env.ENCRYPTION_KEY,
    usageService,
  });
  const r2 = createR2Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const webhooksQueue = createQueue(QUEUE_NAMES.WEBHOOKS);

  const captureIngestService = createCaptureIngestService(db, {
    enqueueFinalize: async () => {
      throw new Error("enqueueFinalize is API-only");
    },
    enqueueWebhookDispatch: async ({ organizationId, reportId }) => {
      const hooks = await webhookService.listActiveEndpointsForEvent(
        organizationId,
        "report.created"
      );
      for (const hook of hooks) {
        await webhooksQueue.add(JOB_NAMES.WEBHOOKS_DISPATCH, {
          event: "report.created",
          eventId: `evt_created_${reportId}`,
          organizationId,
          reportId,
          webhookId: hook.id,
        });
      }
    },
    listRegisteredWebhooks: (organizationId) =>
      webhookService.listActiveEndpointsForEvent(organizationId, "report.created"),
    r2,
    usageService,
  });

  const connection = createRedisConnection();
  const concurrency = resolveWorkerConcurrency(env);

  return new Worker(
    QUEUE_NAMES.INGEST,
    async (job: Job) => {
      if (job.name !== JOB_NAMES.INGEST_FINALIZE) {
        return;
      }
      const payload = ingestFinalizePayloadSchema.parse(job.data);
      await trackFinalizeJobStart(payload.organizationId);
      try {
        await captureIngestService.processFinalizeJob(payload);
      } finally {
        await trackFinalizeJobEnd(payload.organizationId);
      }
    },
    {
      concurrency,
      connection,
    }
  );
}
