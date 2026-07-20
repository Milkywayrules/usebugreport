import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createQueue,
  createRedisConnection,
  JOB_NAMES,
  QUEUE_NAMES,
  webhooksDeliverPayloadSchema,
  webhooksDispatchPayloadSchema,
} from "@usebugreport/queue";
import { createUsageService, createWebhookService } from "@usebugreport/services";
import { type Job, Worker } from "bullmq";

const WEBHOOKS_CONCURRENCY = 10;

export function createWebhooksWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const usageService = createUsageService(db);
  const webhookService = createWebhookService(db, {
    encryptionKey: env.ENCRYPTION_KEY,
    usageService,
  });
  const deliverQueue = createQueue(QUEUE_NAMES.WEBHOOKS);
  const connection = createRedisConnection();

  return new Worker(
    QUEUE_NAMES.WEBHOOKS,
    async (job: Job) => {
      if (job.name === JOB_NAMES.WEBHOOKS_DISPATCH) {
        const payload = webhooksDispatchPayloadSchema.parse(job.data);
        const { deliveryId } = await webhookService.processDispatchJob(payload);
        await deliverQueue.add(
          JOB_NAMES.WEBHOOKS_DELIVER,
          webhooksDeliverPayloadSchema.parse({ deliveryId }),
          { jobId: deliveryId }
        );
        return;
      }

      if (job.name === JOB_NAMES.WEBHOOKS_DELIVER) {
        const payload = webhooksDeliverPayloadSchema.parse(job.data);
        const result = await webhookService.processDeliverJob(payload.deliveryId);
        if (result.retryDelayMs !== undefined) {
          await deliverQueue.add(
            JOB_NAMES.WEBHOOKS_DELIVER,
            webhooksDeliverPayloadSchema.parse({ deliveryId: payload.deliveryId }),
            {
              delay: result.retryDelayMs,
              jobId: `${payload.deliveryId}-retry-${Date.now()}`,
            }
          );
        }
      }
    },
    {
      concurrency: WEBHOOKS_CONCURRENCY,
      connection,
    }
  );
}
