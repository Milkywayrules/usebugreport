import { describe, expect, test } from "bun:test";
import { JOB_NAMES, QUEUE_NAMES } from "@usebugreport/queue";

describe("ingest finalize worker wiring", () => {
  test("uses ingest queue bucket and ingest.finalize job name", () => {
    expect(QUEUE_NAMES.INGEST).toBe("ingest");
    expect(JOB_NAMES.INGEST_FINALIZE).toBe("ingest.finalize");
  });
});
