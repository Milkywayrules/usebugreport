import { describe, expect, test } from "bun:test";
import { resolveWorkerConcurrency } from "./concurrency";

describe("resolveWorkerConcurrency", () => {
  test("keeps configured concurrency when rss is below 70% of limit", () => {
    const limitMb = 2048;
    const rss = Math.floor(limitMb * 1024 * 1024 * 0.5);
    expect(
      resolveWorkerConcurrency(
        { WORKER_CONCURRENCY: 8, WORKER_MEMORY_LIMIT_MB: limitMb },
        rss
      )
    ).toBe(8);
  });

  test("halves concurrency when rss exceeds 70% of container limit", () => {
    const limitMb = 2048;
    const rss = Math.floor(limitMb * 1024 * 1024 * 0.75);
    expect(
      resolveWorkerConcurrency(
        { WORKER_CONCURRENCY: 8, WORKER_MEMORY_LIMIT_MB: limitMb },
        rss
      )
    ).toBe(4);
  });

  test("never drops below 1", () => {
    const limitMb = 512;
    const rss = limitMb * 1024 * 1024;
    expect(
      resolveWorkerConcurrency(
        { WORKER_CONCURRENCY: 1, WORKER_MEMORY_LIMIT_MB: limitMb },
        rss
      )
    ).toBe(1);
  });
});
