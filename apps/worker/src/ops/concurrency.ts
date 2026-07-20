import type { Env } from "@usebugreport/config";

const RSS_PRESSURE_RATIO = 0.7;

export function readProcessRssBytes(): number {
  if (typeof process.memoryUsage === "function") {
    return process.memoryUsage().rss;
  }
  return 0;
}

export function resolveWorkerConcurrency(
  env: Pick<Env, "WORKER_CONCURRENCY" | "WORKER_MEMORY_LIMIT_MB">,
  rssBytes: number = readProcessRssBytes()
): number {
  const configured = Math.min(env.WORKER_CONCURRENCY, 10);
  const limitBytes = env.WORKER_MEMORY_LIMIT_MB * 1024 * 1024;
  if (limitBytes <= 0 || rssBytes <= 0) {
    return configured;
  }
  const ratio = rssBytes / limitBytes;
  if (ratio > RSS_PRESSURE_RATIO) {
    return Math.max(1, Math.floor(configured / 2));
  }
  return configured;
}
