import { beforeEach, describe, expect, test } from "bun:test";
import type { eventWithTime } from "@rrweb/types";
import { EventType } from "@rrweb/types";
import { CircularReplayBuffer } from "../buffer/circular-buffer";

function domEvent(timestamp: number, _isCheckout = false): eventWithTime {
  return {
    data: { href: "https://example.com" },
    timestamp,
    type: EventType.Meta,
  };
}

describe("CircularReplayBuffer", () => {
  beforeEach(() => {
    // deterministic wall clock for eviction tests
  });

  test("default buffer retains events within window", () => {
    const buffer = new CircularReplayBuffer(60);
    const base = 1_000_000;
    buffer.push(domEvent(base), true);
    buffer.push(domEvent(base + 30_000));
    buffer.push(domEvent(base + 45_000), true);

    const events = buffer.getEventsForWindow(60);
    expect(events.length).toBeGreaterThan(0);
    expect(buffer.getSpanSeconds()).toBeLessThanOrEqual(60.5);
  });

  test("evicts segments older than bufferSeconds", () => {
    const buffer = new CircularReplayBuffer(60);
    const base = 2_000_000;

    buffer.push(domEvent(base), true);
    buffer.push(domEvent(base + 10_000));
    buffer.push(domEvent(base + 35_000), true);

    // Simulate 90s elapsed with 60s buffer — oldest segment should be evicted on checkout
    buffer.push(domEvent(base + 95_000), true);
    buffer.push(domEvent(base + 100_000));

    const events = buffer.getEventsForWindow(60);
    const [first] = events;
    const last = events.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (!(first && last)) {
      return;
    }
    const spanSeconds = (last.timestamp - first.timestamp) / 1000;
    expect(spanSeconds).toBeLessThanOrEqual(60.5);
    expect(first.timestamp).toBeGreaterThanOrEqual(base + 95_000 - 60_000);
  });

  test("enforces max replay event count bound", () => {
    const buffer = new CircularReplayBuffer(120);
    const base = 3_000_000;
    buffer.push(domEvent(base), true);
    for (let i = 0; i < 100_050; i += 1) {
      buffer.push(domEvent(base + i));
    }
    expect(buffer.getTotalEventCount()).toBeLessThanOrEqual(100_000);
  });
});

describe("resolveBufferSeconds", () => {
  test("defaults to 120", async () => {
    const { resolveBufferSeconds } = await import("../record");
    const { DEFAULT_BUFFER_SECONDS } = await import("../types");
    expect(resolveBufferSeconds(undefined)).toBe(DEFAULT_BUFFER_SECONDS);
    expect(DEFAULT_BUFFER_SECONDS).toBe(120);
  });

  test("clamps out-of-range values", async () => {
    const { resolveBufferSeconds } = await import("../record");
    expect(resolveBufferSeconds(10)).toBe(30);
    expect(resolveBufferSeconds(200)).toBe(120);
  });

  test("throws in strict mode", async () => {
    const { resolveBufferSeconds } = await import("../record");
    expect(() => resolveBufferSeconds(10, true)).toThrow(RangeError);
  });
});

describe("checkoutEveryNms", () => {
  test("uses half window capped at 60s", async () => {
    const { checkoutEveryNms } = await import("../record");
    expect(checkoutEveryNms(120)).toBe(60_000);
    expect(checkoutEveryNms(60)).toBe(30_000);
  });
});
