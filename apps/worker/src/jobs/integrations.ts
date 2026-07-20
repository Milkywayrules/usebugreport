import { parseEnv } from "@usebugreport/config";
import { createDbClient } from "@usebugreport/db";
import {
  createRedisConnection,
  integrationsLinearPushPayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
} from "@usebugreport/queue";
import {
  createIntegrationService,
  createUsageService,
} from "@usebugreport/services";
import { type Job, Worker } from "bullmq";

const LINEAR_PUSH_CONCURRENCY = 5;

export function createIntegrationsWorker(): Worker {
  const env = parseEnv(process.env);
  const db = createDbClient(env.DATABASE_URL);
  const usageService = createUsageService(db);
  const integrationService = createIntegrationService(db, {
    appUrl: env.APP_URL,
    encryptionKey: env.ENCRYPTION_KEY,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    linearClientId: env.LINEAR_CLIENT_ID,
    linearClientSecret: env.LINEAR_CLIENT_SECRET,
    usageService,
  });

  const connection = createRedisConnection();

  return new Worker(
    QUEUE_NAMES.INTEGRATIONS,
    async (job: Job) => {
      if (job.name === JOB_NAMES.INTEGRATIONS_LINEAR_PUSH) {
        const payload = integrationsLinearPushPayloadSchema.parse(job.data);
        await integrationService.processLinearPushJob(payload.operationId);
        return;
      }
      if (job.name === JOB_NAMES.INTEGRATIONS_GITHUB_PUSH) {
        const payload = integrationsLinearPushPayloadSchema.parse(job.data);
        await integrationService.processGitHubPushJob(payload.operationId);
        return;
      }
    },
    {
      concurrency: LINEAR_PUSH_CONCURRENCY,
      connection,
    }
  );
}
