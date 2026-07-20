import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ingestFinalizePayloadSchema } from "../payloads/ingest";

const payloadDir = join(import.meta.dir, "..", "payloads");
const BUFFER_PATTERN = /\bBuffer\b/;
const UINT8_ARRAY_PATTERN = /\bUint8Array\b/;

describe("queue payload invariant", () => {
  test("payload modules contain no Buffer or Uint8Array references", async () => {
    const files = await readdir(payloadDir);
    const tsFiles = files.filter((file) => file.endsWith(".ts"));
    const sources = await Promise.all(
      tsFiles.map((file) => readFile(join(payloadDir, file), "utf8"))
    );

    for (const source of sources) {
      expect(source).not.toMatch(BUFFER_PATTERN);
      expect(source).not.toMatch(UINT8_ARRAY_PATTERN);
    }
  });

  test("ingestFinalizePayloadSchema accepts refs-only payload", () => {
    const parsed = ingestFinalizePayloadSchema.parse({
      idempotencyKey: "idem-1",
      projectId: "prj_test",
      r2Keys: ["org/prj/rpt/replay/batch-1.json.gz"],
      reportId: "rpt_test",
    });

    expect(parsed.reportId).toBe("rpt_test");
  });

  test("ingestFinalizePayloadSchema rejects binary payload fields", () => {
    expect(() =>
      ingestFinalizePayloadSchema.parse({
        body: new Uint8Array([1, 2, 3]),
        idempotencyKey: "idem-1",
        projectId: "prj_test",
        r2Keys: [],
        reportId: "rpt_test",
      })
    ).toThrow();
  });
});
