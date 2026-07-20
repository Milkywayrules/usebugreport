import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createQueue,
  createRedisConnection,
  ingestFinalizePayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
} from "@usebugreport/queue";
import {
  createCaptureIngestService,
  createUsageService,
} from "@usebugreport/services";
import { createR2Client } from "@usebugreport/storage";
import { type Job, Worker } from "bullmq";

async function listRegisteredWebhooks(
  _organizationId: string
): Promise<Array<{ id: string }>> {
  // Webhook registration lands in E8 — no endpoints registered yet.
  return [];
}

export function createIngestFinalizeWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const usageService = createUsageService(db);
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
      const hooks = await listRegisteredWebhooks(organizationId);
      for (const hook of hooks) {
        await webhooksQueue.add(JOB_NAMES.WEBHOOKS_DISPATCH, {
          eventId: `evt_${reportId}`,
          reportId,
          webhookId: hook.id,
        });
      }
    },
    listRegisteredWebhooks,
    r2,
    usageService,
  });

  const connection = createRedisConnection();
  const concurrency = Math.min(env.WORKER_CONCURRENCY, 10);

  return new Worker(
    QUEUE_NAMES.INGEST,
    async (job: Job) => {
      if (job.name !== JOB_NAMES.INGEST_FINALIZE) {
        return;
      }
      const payload = ingestFinalizePayloadSchema.parse(job.data);
      await captureIngestService.processFinalizeJob(payload);
    },
    {
      concurrency,
      connection,
    }
  );
}
