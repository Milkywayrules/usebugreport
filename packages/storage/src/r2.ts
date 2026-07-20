import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2ClientConfig {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  secretAccessKey: string;
}

export interface R2Client {
  bucket: string;
  client: S3Client;
  presignGet: (key: string, expiresInSeconds?: number) => Promise<string>;
  presignPut: (
    key: string,
    contentType: string,
    expiresInSeconds?: number
  ) => Promise<string>;
}

const DEFAULT_PUT_EXPIRES_SECONDS = 900;
const DEFAULT_GET_EXPIRES_SECONDS = 900;

export function createR2Client(config: R2ClientConfig): R2Client {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: false,
    region: "auto",
  });

  return {
    bucket: config.bucket,
    client,
    presignGet: (key, expiresInSeconds = DEFAULT_GET_EXPIRES_SECONDS) =>
      presignGet(client, config.bucket, key, expiresInSeconds),
    presignPut: (
      key,
      contentType,
      expiresInSeconds = DEFAULT_PUT_EXPIRES_SECONDS
    ) => presignPut(client, config.bucket, key, contentType, expiresInSeconds),
  };
}

export function presignPut(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresInSeconds = DEFAULT_PUT_EXPIRES_SECONDS
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    ContentType: contentType,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function presignGet(
  client: S3Client,
  bucket: string,
  key: string,
  expiresInSeconds = DEFAULT_GET_EXPIRES_SECONDS
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
