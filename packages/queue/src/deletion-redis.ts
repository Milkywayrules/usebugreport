import { parseEnv } from "@usebugreport/config";
import Redis from "ioredis";

let sharedRedis: Redis | null = null;

function redisClient(): Redis {
  if (!sharedRedis) {
    const env = parseEnv(process.env);
    sharedRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  }
  return sharedRedis;
}

export async function purgeOrganizationRedisKeys(
  organizationId: string,
  projectIds: string[]
): Promise<void> {
  const redis = redisClient();
  await redis.del(`ingest:finalize:active:${organizationId}`);

  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `ubr:*:${organizationId}:*`,
      "COUNT",
      200
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");

  for (const projectId of projectIds) {
    let rateCursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        rateCursor,
        "MATCH",
        `ingest:rate:${projectId}:*`,
        "COUNT",
        200
      );
      rateCursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (rateCursor !== "0");
  }
}
