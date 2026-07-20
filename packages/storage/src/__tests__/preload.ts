import { mock } from "bun:test";

export const s3SendMock = mock(() => Promise.resolve({}));

mock.module("@aws-sdk/client-s3", () => {
  class MockCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  return {
    DeleteObjectCommand: MockCommand,
    GetObjectCommand: MockCommand,
    HeadObjectCommand: MockCommand,
    ListObjectsV2Command: MockCommand,
    PutObjectCommand: MockCommand,
    S3Client: class S3Client {
      send = s3SendMock;
    },
  };
});
