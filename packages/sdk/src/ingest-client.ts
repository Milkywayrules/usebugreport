import type { CaptureSubmitPayload } from "@usebugreport/capture-core";

/** Matches `INLINE_INGEST_MAX_BYTES` in @usebugreport/config (SDK avoids extra dep). */
const INLINE_INGEST_MAX_BYTES = 1_048_576;
const REPLAY_BATCH_IN_KEY = /batch-(\d+)/;
const TRAILING_SLASH = /\/$/;

export class UseBugReportIngestError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "UseBugReportIngestError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface UploadCaptureOptions {
  apiBaseUrl: string;
  description?: string;
  idempotencyKey?: string;
  payload: CaptureSubmitPayload;
  projectKey: string;
  title: string;
}

export interface UploadCaptureResult {
  reportId: string;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

function ingestHeaders(
  projectKey: string,
  idempotencyKey: string
): HeadersInit {
  return {
    "Idempotency-Key": idempotencyKey,
    "X-Ingest-Key": projectKey,
  };
}

function estimatePayloadBytes(payload: CaptureSubmitPayload): number {
  let total = payload.parts.meta.blob.size;
  total += payload.parts.console.blob.size;
  total += payload.parts.network.blob.size;
  for (const replayPart of payload.parts.replay) {
    total += replayPart.blob.size;
  }
  if (payload.parts.screenshot) {
    total += payload.parts.screenshot.blob.size;
  }
  return total;
}

async function readApiError(
  response: Response
): Promise<UseBugReportIngestError> {
  let code = "INGEST_FAILED";
  let message = `Ingest failed (${response.status}).`;
  try {
    const body = (await response.json()) as ApiErrorBody;
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // keep defaults
  }
  return new UseBugReportIngestError(code, message, response.status);
}

function buildPresignParts(payload: CaptureSubmitPayload) {
  const parts: Array<{
    contentType: string;
    name: "console" | "meta" | "network" | "replay" | "screenshot";
    seq?: number;
  }> = [
    { contentType: "application/json", name: "meta" },
    { contentType: "application/gzip", name: "console" },
    { contentType: "application/gzip", name: "network" },
  ];

  for (const replayPart of payload.parts.replay) {
    parts.push({
      contentType: "application/gzip",
      name: "replay",
      seq: replayPart.seq ?? 0,
    });
  }

  if (payload.parts.screenshot) {
    parts.push({ contentType: "image/webp", name: "screenshot" });
  }

  return parts;
}

async function uploadInline(
  options: UploadCaptureOptions,
  idempotencyKey: string
): Promise<UploadCaptureResult> {
  const form = new FormData();
  form.set("title", options.title);
  if (options.description) {
    form.set("description", options.description);
  }

  form.set("meta", payloadFile(options.payload.parts.meta.blob, "meta.json"));
  form.set(
    "console",
    payloadFile(options.payload.parts.console.blob, "console.json.gz")
  );
  form.set(
    "network",
    payloadFile(options.payload.parts.network.blob, "network.json.gz")
  );

  const [replayPart] = options.payload.parts.replay;
  if (replayPart) {
    if (options.payload.parts.replay.length > 1) {
      form.set("replaySeq", String(replayPart.seq ?? 0));
    }
    form.set(
      "replay",
      payloadFile(replayPart.blob, `batch-${replayPart.seq ?? 0}.json.gz`)
    );
  }

  if (options.payload.parts.screenshot) {
    form.set(
      "screenshot",
      payloadFile(options.payload.parts.screenshot.blob, "screenshot.webp")
    );
  }

  const response = await fetch(
    `${trimBaseUrl(options.apiBaseUrl)}/api/v1/capture/ingest`,
    {
      body: form,
      headers: ingestHeaders(options.projectKey, idempotencyKey),
      method: "POST",
    }
  );

  if (!response.ok) {
    throw await readApiError(response);
  }

  const body = (await response.json()) as { reportId?: string };
  if (!body.reportId) {
    throw new UseBugReportIngestError(
      "INGEST_FAILED",
      "Ingest response missing reportId.",
      response.status
    );
  }

  return { reportId: body.reportId };
}

function payloadFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: blob.type || "application/octet-stream",
  });
}

async function uploadPresigned(
  options: UploadCaptureOptions,
  idempotencyKey: string
): Promise<UploadCaptureResult> {
  const presignResponse = await fetch(
    `${trimBaseUrl(options.apiBaseUrl)}/api/v1/capture/presign`,
    {
      body: JSON.stringify({
        description: options.description,
        parts: buildPresignParts(options.payload),
        title: options.title,
      }),
      headers: {
        ...ingestHeaders(options.projectKey, idempotencyKey),
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  if (!presignResponse.ok) {
    throw await readApiError(presignResponse);
  }

  const presignBody = (await presignResponse.json()) as {
    reportId: string;
    uploads: Array<{
      contentType: string;
      key: string;
      part: string;
      url: string;
    }>;
  };

  const r2Keys: string[] = [];
  await Promise.all(
    presignBody.uploads.map(async (upload) => {
      const blob = blobForUpload(options.payload, upload.part, upload.key);
      if (!blob) {
        throw new UseBugReportIngestError(
          "INGEST_FAILED",
          `Missing blob for upload part ${upload.part}.`,
          422
        );
      }
      const putResponse = await fetch(upload.url, {
        body: blob,
        headers: { "Content-Type": upload.contentType },
        method: "PUT",
      });
      if (!putResponse.ok) {
        throw new UseBugReportIngestError(
          "STORAGE_UPLOAD_FAILED",
          `Failed to upload ${upload.part} to storage.`,
          putResponse.status
        );
      }
      r2Keys.push(upload.key);
    })
  );

  const completeResponse = await fetch(
    `${trimBaseUrl(options.apiBaseUrl)}/api/v1/capture/complete`,
    {
      body: JSON.stringify({ r2Keys, reportId: presignBody.reportId }),
      headers: {
        ...ingestHeaders(options.projectKey, idempotencyKey),
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  if (!completeResponse.ok) {
    throw await readApiError(completeResponse);
  }

  return { reportId: presignBody.reportId };
}

function blobForUpload(
  payload: CaptureSubmitPayload,
  partName: string,
  r2Key: string
): Blob | null {
  if (partName === "meta") {
    return payload.parts.meta.blob;
  }
  if (partName === "console") {
    return payload.parts.console.blob;
  }
  if (partName === "network") {
    return payload.parts.network.blob;
  }
  if (partName === "screenshot") {
    return payload.parts.screenshot?.blob ?? null;
  }
  if (partName === "replay") {
    const match = REPLAY_BATCH_IN_KEY.exec(r2Key);
    const seq = match ? Number(match[1]) : 0;
    const replay =
      payload.parts.replay.find((entry) => (entry.seq ?? 0) === seq) ??
      payload.parts.replay[0];
    return replay?.blob ?? null;
  }
  return null;
}
function trimBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(TRAILING_SLASH, "");
}

export function uploadCapturePayload(
  options: UploadCaptureOptions
): Promise<UploadCaptureResult> {
  const idempotencyKey = options.idempotencyKey ?? crypto.randomUUID();
  const bytes = estimatePayloadBytes(options.payload);
  if (bytes <= INLINE_INGEST_MAX_BYTES) {
    return uploadInline(options, idempotencyKey);
  }
  return uploadPresigned(options, idempotencyKey);
}
