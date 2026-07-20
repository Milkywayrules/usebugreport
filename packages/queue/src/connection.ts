import { parseEnv } from "@usebugreport/config";
import { type ConnectionOptions, Queue } from "bullmq";
import type { z } from "zod";
import type { QueueName } from "./names";

export function createRedisConnection(): ConnectionOptions {
  const env = parseEnv(process.env);

  return {
    maxRetriesPerRequest: null,
    url: env.REDIS_URL,
  };
}

export function getQueueOptions() {
  return {
    connection: createRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  } as const;
}

export function createQueue<TPayload>(
  name: QueueName,
  _payloadSchema?: z.ZodType<TPayload>
): Queue<TPayload, TPayload, string> {
  return new Queue<TPayload, TPayload, string>(name, getQueueOptions());
}
