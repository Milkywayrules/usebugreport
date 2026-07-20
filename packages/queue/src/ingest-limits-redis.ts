import { createHash } from "node:crypto";
import { parseEnv } from "@usebugreport/config";
import Redis from "ioredis";

const INGEST_RATE_WINDOW_MS = 60_000;
const INGEST_RATE_BURST = 20;

const FINALIZE_ACTIVE_PREFIX = "ingest:finalize:active:";
const FINALIZE_ACTIVE_TTL_SECONDS = 3600;

let sharedRedis: Redis | null = null;

function redisClient(): Redis {
  if (!sharedRedis) {
    const env = parseEnv(process.env);
    sharedRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  }
  return sharedRedis;
}

function ingestKeyFingerprint(ingestKey: string): string {
  return createHash("sha256").update(ingestKey).digest("hex").slice(0, 16);
}

export interface IngestRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkIngestKeyRateLimit(input: {
  ingestKey: string;
  projectId: string;
}): Promise<IngestRateLimitResult> {
  const redis = redisClient();
  const now = Date.now();
  const key = `ingest:rate:${input.projectId}:${ingestKeyFingerprint(input.ingestKey)}`;

  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, now - INGEST_RATE_WINDOW_MS);
  pipeline.zcard(key);
  const inspect = await pipeline.exec();
  const current = Number(inspect?.[1]?.[1] ?? 0);
  if (current >= INGEST_RATE_BURST) {
    return { allowed: false, retryAfterSeconds: 60 };
  }

  await redis
    .multi()
    .zadd(key, now, member)
    .pexpire(key, INGEST_RATE_WINDOW_MS)
    .exec();
  return { allowed: true };
}

export async function getActiveFinalizeCount(
  organizationId: string
): Promise<number> {
  const redis = redisClient();
  const value = await redis.get(`${FINALIZE_ACTIVE_PREFIX}${organizationId}`);
  return value ? Number.parseInt(value, 10) : 0;
}

export async function trackFinalizeJobStart(
  organizationId: string
): Promise<void> {
  const redis = redisClient();
  const key = `${FINALIZE_ACTIVE_PREFIX}${organizationId}`;
  const next = await redis.incr(key);
  if (next === 1) {
    await redis.expire(key, FINALIZE_ACTIVE_TTL_SECONDS);
  }
}

export async function trackFinalizeJobEnd(
  organizationId: string
): Promise<void> {
  const redis = redisClient();
  const key = `${FINALIZE_ACTIVE_PREFIX}${organizationId}`;
  const next = await redis.decr(key);
  if (next <= 0) {
    await redis.del(key);
  }
}
