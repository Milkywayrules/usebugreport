import { beforeEach, describe, expect, mock, test } from "bun:test";

import { s3SendMock } from "./preload";

const getSignedUrlMock = mock(() =>
  Promise.resolve("https://signed.example/url")
);

mock.module("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

const { createR2Client, headObject, putObject } = await import("../r2");

function firstPutCall(): { input: Record<string, unknown> } | undefined {
  const [command] = s3SendMock.mock.calls[0] ?? [];
  return command as { input: Record<string, unknown> } | undefined;
}

describe("R2 putObject", () => {
  beforeEach(() => {
    s3SendMock.mockClear();
  });

  test("putObject uploads body with bucket, key, and content type", async () => {
    const client = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "test-bucket",
      secretAccessKey: "secret",
    });

    const body = new Uint8Array([1, 2, 3]);
    await client.putObject("org/prj/rpt/meta.json", body, "application/json");

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    const command = firstPutCall();
    if (!command) {
      throw new Error("expected putObject call");
    }
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toBe("org/prj/rpt/meta.json");
    expect(command.input.ContentType).toBe("application/json");
    expect(command.input.Body).toBe(body);
  });

  test("headObject returns content length and type", async () => {
    s3SendMock.mockImplementationOnce(() =>
      Promise.resolve({ ContentLength: 42, ContentType: "application/gzip" })
    );
    const client = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "test-bucket",
      secretAccessKey: "secret",
    });

    const head = await client.headObject("org/prj/rpt/console.json.gz");
    expect(head.contentLength).toBe(42);
    expect(head.contentType).toBe("application/gzip");
  });

  test("standalone headObject accepts injected client", async () => {
    s3SendMock.mockImplementationOnce(() =>
      Promise.resolve({ ContentLength: 10, ContentType: "application/json" })
    );
    const r2 = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "bucket-a",
      secretAccessKey: "secret",
    });

    const head = await headObject(r2.client, "bucket-a", "meta.json");
    expect(head.contentLength).toBe(10);
  });

  test("standalone putObject accepts injected client", async () => {
    const r2 = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "bucket-a",
      secretAccessKey: "secret",
    });

    const body = Buffer.from("payload");
    await putObject(r2.client, "bucket-a", "key-a", body, "text/plain");

    const command = firstPutCall();
    if (!command) {
      throw new Error("expected putObject call");
    }
    expect(command.input.Body).toBe(body);
  });
});
