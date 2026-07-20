import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

/** Bun-friendly object body for direct R2 uploads (Uint8Array or Node Buffer). */
export type R2ObjectBody = Uint8Array | Buffer;

export interface R2ObjectHead {
  contentLength: number;
  contentType: string | undefined;
}

export interface R2ListedObject {
  key: string;
  lastModified: Date | undefined;
}

export interface R2Client {
  bucket: string;
  client: S3Client;
  getObject: (key: string) => Promise<Uint8Array>;
  headObject: (key: string) => Promise<R2ObjectHead>;
  presignGet: (key: string, expiresInSeconds?: number) => Promise<string>;
  presignPut: (
    key: string,
    contentType: string,
    expiresInSeconds?: number
  ) => Promise<string>;
  putObject: (
    key: string,
    body: R2ObjectBody,
    contentType: string
  ) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  listObjects: (prefix: string) => Promise<R2ListedObject[]>;
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
    getObject: (key) => getObject(client, config.bucket, key),
    headObject: (key) => headObject(client, config.bucket, key),
    presignGet: (key, expiresInSeconds = DEFAULT_GET_EXPIRES_SECONDS) =>
      presignGet(client, config.bucket, key, expiresInSeconds),
    presignPut: (
      key,
      contentType,
      expiresInSeconds = DEFAULT_PUT_EXPIRES_SECONDS
    ) => presignPut(client, config.bucket, key, contentType, expiresInSeconds),
    putObject: (key, body, contentType) =>
      putObject(client, config.bucket, key, body, contentType),
    deleteObject: (key) => deleteObject(client, config.bucket, key),
    listObjects: (prefix) => listObjects(client, config.bucket, prefix),
  };
}

export function putObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: R2ObjectBody,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Body: body,
    Bucket: bucket,
    ContentType: contentType,
    Key: key,
  });

  return client.send(command).then(() => undefined);
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

export async function headObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<R2ObjectHead> {
  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const result = await client.send(command);
  return {
    contentLength: result.ContentLength ?? 0,
    contentType: result.ContentType,
  };
}

export async function getObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Uint8Array> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const result = await client.send(command);
  if (!result.Body) {
    throw new Error("R2 object body missing");
  }
  const bytes = await result.Body.transformToByteArray();
  return new Uint8Array(bytes);
}


export function deleteObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return client.send(command).then(() => undefined);
}

export async function listObjects(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<R2ListedObject[]> {
  const objects: R2ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      Prefix: prefix,
    });
    const result = await client.send(command);
    for (const item of result.Contents ?? []) {
      if (item.Key) {
        objects.push({
          key: item.Key,
          lastModified: item.LastModified,
        });
      }
    }
    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}
