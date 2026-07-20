import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createQueue,
  createRedisConnection,
  deletionStepPayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
} from "@usebugreport/queue";
import { purgeOrganizationRedisKeys } from "@usebugreport/queue";
import { createDeletionService } from "@usebugreport/services";
import { createR2Client } from "@usebugreport/storage";
import { type Job, Worker } from "bullmq";

const DELETION_CONCURRENCY = 2;

export function createDeletionWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const r2 = createR2Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const deletionQueue = createQueue(QUEUE_NAMES.DELETION, deletionStepPayloadSchema);
  const connection = createRedisConnection();

  const deletionService = createDeletionService(db, {
    purgeOrgRedisKeys: purgeOrganizationRedisKeys,
    r2,
    enqueueDeletionJob: async (jobName, payload) => {
      await deletionQueue.add(jobName, deletionStepPayloadSchema.parse(payload), {
        jobId: `${payload.tombstoneId}-${jobName}-${Date.now()}`,
      });
    },
  });

  return new Worker(
    QUEUE_NAMES.DELETION,
    async (job: Job) => {
      const payload = deletionStepPayloadSchema.parse(job.data);
      if (job.name === JOB_NAMES.DELETION_NOTIFY_OWNER) {
        await deletionService.processNotifyOwner(payload);
        return;
      }
      if (job.name === JOB_NAMES.DELETION_EXTERNAL_PURGE) {
        await deletionService.processExternalPurge(payload);
        return;
      }
    },
    {
      concurrency: DELETION_CONCURRENCY,
      connection,
    }
  );
}
