import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const getSignedUrlMock = mock(() =>
  Promise.resolve("https://signed.example/url")
);

mock.module("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

const { createR2Client, presignPut } = await import("../r2");

function firstPresignCall():
  | [unknown, PutObjectCommand, { expiresIn: number }]
  | undefined {
  const [call] = getSignedUrlMock.mock.calls;
  return call as [unknown, PutObjectCommand, { expiresIn: number }] | undefined;
}

function firstGetCall(): [unknown, GetObjectCommand] | undefined {
  const [call] = getSignedUrlMock.mock.calls;
  return call as [unknown, GetObjectCommand] | undefined;
}

describe("R2 presign helpers", () => {
  beforeEach(() => {
    getSignedUrlMock.mockClear();
  });

  test("presignPut returns URL and uses bucket + key", async () => {
    const client = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "test-bucket",
      secretAccessKey: "secret",
    });

    const url = await client.presignPut(
      "org/prj/rpt/replay/batch-1.json.gz",
      "application/gzip"
    );

    expect(url).toBe("https://signed.example/url");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);

    const [, command, options] = firstPresignCall() ?? [];

    expect(command?.input.Bucket).toBe("test-bucket");
    expect(command?.input.Key).toBe("org/prj/rpt/replay/batch-1.json.gz");
    expect(command?.input.ContentType).toBe("application/gzip");
    expect(options?.expiresIn).toBe(900);
  });

  test("presignGet returns URL with configured bucket", async () => {
    const client = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "test-bucket",
      secretAccessKey: "secret",
    });

    const url = await client.presignGet("org/prj/rpt/meta/manifest.json");

    expect(url).toBe("https://signed.example/url");

    const [, command] = firstGetCall() ?? [];

    expect(command?.input.Bucket).toBe("test-bucket");
    expect(command?.input.Key).toBe("org/prj/rpt/meta/manifest.json");
  });

  test("standalone presign helpers accept injected client", async () => {
    const r2 = createR2Client({
      accessKeyId: "key",
      accountId: "acct",
      bucket: "bucket-a",
      secretAccessKey: "secret",
    });

    await presignPut(r2.client, "bucket-a", "key-a", "text/plain", 600);

    const [, , options] = firstPresignCall() ?? [];

    expect(options?.expiresIn).toBe(600);
  });
});
