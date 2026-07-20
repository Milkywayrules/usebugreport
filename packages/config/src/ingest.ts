/** Hard cap for inline multipart ingest (architecture §4). */
export const INLINE_INGEST_MAX_BYTES = 1_048_576;

/**
 * Inline-only ack p95 target in milliseconds. May be raised after Frankfurt→R2
 * measurement if RTT exceeds 200ms — never weaken stream-to-R2-before-ack.
 */
export const INLINE_INGEST_ACK_P95_TARGET_MS = 200;
