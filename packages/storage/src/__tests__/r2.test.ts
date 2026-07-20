import { beforeEach, describe, expect, mock, test } from "bun:test";

const sendMock = mock(() => Promise.resolve({}));

mock.module("@aws-sdk/client-s3", () => ({
  GetObjectCommand: class MockGetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  PutObjectCommand: class MockPutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  S3Client: class S3Client {
    send = sendMock;
  },
}));

const getSignedUrlMock = mock(() =>
  Promise.resolve("https://signed.example/url")
);

mock.module("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

const { createR2Client, putObject } = await import("../r2");

function firstPutCall(): { input: Record<string, unknown> } | undefined {
  const [command] = sendMock.mock.calls[0] ?? [];
  return command as { input: Record<string, unknown> } | undefined;
}

describe("R2 putObject", () => {
  beforeEach(() => {
    sendMock.mockClear();
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

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = firstPutCall();
    if (!command) {
      throw new Error("expected putObject call");
    }
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toBe("org/prj/rpt/meta.json");
    expect(command.input.ContentType).toBe("application/json");
    expect(command.input.Body).toBe(body);
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
