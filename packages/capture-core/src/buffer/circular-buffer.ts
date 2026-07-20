import type { eventWithTime } from "@rrweb/types";
import { MAX_REPLAY_EVENT_COUNT } from "../types";

/** Checkout segment with wall-clock start time for eviction. */
interface Segment {
  events: eventWithTime[];
  startedAt: number;
}

/**
 * Circular replay buffer using rrweb checkout segmentation.
 * Segments are evicted when their start time falls outside `bufferSeconds`.
 */
export class CircularReplayBuffer {
  private bufferSeconds: number;
  private segments: Segment[] = [];
  private currentSegment: eventWithTime[] = [];
  private currentSegmentStartedAt = 0;
  private totalEventCount = 0;

  constructor(bufferSeconds: number) {
    this.bufferSeconds = bufferSeconds;
  }

  setBufferSeconds(seconds: number): void {
    this.bufferSeconds = seconds;
    this.evictExpired(Date.now());
  }

  push(event: eventWithTime, isCheckout?: boolean): void {
    if (this.currentSegment.length === 0) {
      this.currentSegmentStartedAt = event.timestamp;
    }

    this.currentSegment.push(event);
    this.totalEventCount += 1;
    this.enforceEventCountBound();

    if (isCheckout) {
      this.segments.push({
        events: this.currentSegment,
        startedAt: this.currentSegmentStartedAt,
      });
      this.currentSegment = [];
      this.evictExpired(event.timestamp);
    }
  }

  /**
   * Returns replay events covering the last `seconds` of wall time (default: full buffer window).
   * Merges checkout segments per rrweb checkout recipe — oldest retained segment provides the
   * initial full snapshot required for replay.
   */
  getEventsForWindow(seconds?: number): eventWithTime[] {
    const windowMs = (seconds ?? this.bufferSeconds) * 1000;
    const now = this.latestTimestamp();
    if (now === 0) {
      return [];
    }
    const cutoff = now - windowMs;

    const retainedSegments = this.segments.filter(
      (segment) => this.segmentEndTime(segment) >= cutoff
    );

    const tail = this.currentSegment.filter(
      (event) => event.timestamp >= cutoff
    );

    if (retainedSegments.length === 0 && tail.length === 0) {
      return [];
    }

    const merged: eventWithTime[] = [];
    for (const segment of retainedSegments) {
      for (const event of segment.events) {
        if (event.timestamp >= cutoff) {
          merged.push(event);
        }
      }
    }
    for (const event of tail) {
      merged.push(event);
    }

    merged.sort((a, b) => a.timestamp - b.timestamp);
    return merged;
  }

  getSpanSeconds(): number {
    const events = this.getEventsForWindow();
    if (events.length < 2) {
      return 0;
    }
    const [first] = events;
    const last = events.at(-1);
    if (!(first && last)) {
      return 0;
    }
    return (last.timestamp - first.timestamp) / 1000;
  }

  getTotalEventCount(): number {
    return this.totalEventCount;
  }

  clear(): void {
    this.segments = [];
    this.currentSegment = [];
    this.currentSegmentStartedAt = 0;
    this.totalEventCount = 0;
  }

  private latestTimestamp(): number {
    const lastOpen = this.currentSegment.at(-1);
    const lastClosed = this.segments.at(-1)?.events.at(-1);
    return Math.max(lastOpen?.timestamp ?? 0, lastClosed?.timestamp ?? 0);
  }

  private segmentEndTime(segment: Segment): number {
    const last = segment.events.at(-1);
    return last?.timestamp ?? segment.startedAt;
  }

  private evictExpired(referenceTimestamp: number): void {
    const cutoff = referenceTimestamp - this.bufferSeconds * 1000;
    while (this.segments.length > 0) {
      const [oldest] = this.segments;
      if (!oldest || this.segmentEndTime(oldest) >= cutoff) {
        break;
      }
      this.totalEventCount -= oldest.events.length;
      this.segments.shift();
    }
  }

  private enforceEventCountBound(): void {
    while (this.totalEventCount > MAX_REPLAY_EVENT_COUNT) {
      const oldest = this.segments.shift();
      if (oldest) {
        this.totalEventCount -= oldest.events.length;
        continue;
      }
      if (this.currentSegment.length > 0) {
        this.currentSegment.shift();
        this.totalEventCount -= 1;
        continue;
      }
      break;
    }
  }
}
