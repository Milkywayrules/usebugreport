import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createRedisConnection,
  JOB_NAMES,
  QUEUE_NAMES,
  retentionSweepPayloadSchema,
} from "@usebugreport/queue";
import { createRetentionService, createUsageService } from "@usebugreport/services";
import { createR2Client } from "@usebugreport/storage";
import { type Job, Worker } from "bullmq";

export function createRetentionSweepWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const r2 = createR2Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const usageService = createUsageService(db, { r2 });
  const retentionService = createRetentionService(db, {
    getRetentionDays: (organizationId) =>
      usageService.getRetentionDays(organizationId),
    r2,
  });

  const connection = createRedisConnection();

  return new Worker(
    QUEUE_NAMES.RETENTION,
    async (job: Job) => {
      if (job.name !== JOB_NAMES.RETENTION_SWEEP) {
        return;
      }

      const payload = retentionSweepPayloadSchema.parse(job.data);
      const sweepDate = new Date(payload.sweepDate);

      return retentionService.runSweep(payload.organizationId, sweepDate);
    },
    {
      concurrency: 1,
      connection,
    }
  );
}
