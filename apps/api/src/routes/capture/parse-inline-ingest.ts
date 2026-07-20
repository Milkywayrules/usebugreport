import { INLINE_INGEST_MAX_BYTES } from "@usebugreport/config";
import type {
  InlineIngestInput,
  InlineIngestPart,
} from "@usebugreport/services";

const INLINE_PART_NAMES = new Set([
  "replay",
  "console",
  "network",
  "meta",
  "screenshot",
]);

const EXPECTED_CONTENT_TYPES: Record<string, string[]> = {
  console: ["application/gzip", "application/x-gzip"],
  meta: ["application/json"],
  network: ["application/gzip", "application/x-gzip"],
  replay: ["application/gzip", "application/x-gzip"],
  screenshot: ["image/webp"],
};

export class InlineIngestParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InlineIngestParseError";
  }
}

function isMultipartContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().startsWith("multipart/form-data");
}

function readContentLength(request: Request): number | null {
  const header = request.headers.get("Content-Length")?.trim();
  if (!header) {
    return null;
  }
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

function parseReplaySeq(value: FormDataEntryValue | null): number {
  if (value === null || value === "") {
    return 0;
  }
  if (typeof value !== "string") {
    throw new InlineIngestParseError("replaySeq must be a text field.");
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InlineIngestParseError(
      "Replay seq must be a non-negative integer."
    );
  }
  return parsed;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function assertContentType(partName: string, contentType: string): void {
  const normalized = normalizeContentType(contentType);
  const allowed = EXPECTED_CONTENT_TYPES[partName];
  if (!allowed?.includes(normalized)) {
    throw new InlineIngestParseError(
      `Invalid content type for ${partName}: ${contentType}.`
    );
  }
}

export async function parseInlineIngestRequest(
  request: Request
): Promise<InlineIngestInput> {
  if (!isMultipartContentType(request.headers.get("Content-Type"))) {
    throw new InlineIngestParseError(
      "Content-Type must be multipart/form-data."
    );
  }

  const contentLength = readContentLength(request);
  if (contentLength !== null && contentLength > INLINE_INGEST_MAX_BYTES) {
    throw new InlineIngestParseError(
      "Inline ingest limited to 1 MB; use POST /api/v1/capture/presign for larger payloads."
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    throw new InlineIngestParseError("Invalid multipart form data.", {
      cause: error,
    });
  }

  const titleEntry = formData.get("title");
  const descriptionEntry = formData.get("description");
  const replaySeq = parseReplaySeq(formData.get("replaySeq"));

  const parts: InlineIngestPart[] = [];
  let totalBytes = 0;

  for (const [fieldName, entry] of formData.entries()) {
    if (
      fieldName === "title" ||
      fieldName === "description" ||
      fieldName === "replaySeq"
    ) {
      continue;
    }

    if (!INLINE_PART_NAMES.has(fieldName)) {
      throw new InlineIngestParseError(`Unknown upload part: ${fieldName}.`);
    }

    if (typeof entry === "string") {
      throw new InlineIngestParseError(
        `Upload part ${fieldName} must be a file.`
      );
    }

    const file = entry as File;

    // Sequential reads enforce INLINE_INGEST_MAX_BYTES while parsing.
    // biome-ignore lint/performance/noAwaitInLoops: size guard must stop at first overflow
    const body = await fileToUint8Array(file);
    totalBytes += body.byteLength;
    if (totalBytes > INLINE_INGEST_MAX_BYTES) {
      throw new InlineIngestParseError(
        "Inline ingest limited to 1 MB; use POST /api/v1/capture/presign for larger payloads."
      );
    }

    const contentType = file.type || "application/octet-stream";
    assertContentType(fieldName, contentType);

    parts.push({
      body,
      contentType: normalizeContentType(contentType),
      name: fieldName as InlineIngestPart["name"],
      seq: fieldName === "replay" ? replaySeq : undefined,
    });
  }

  if (parts.length === 0) {
    throw new InlineIngestParseError("At least one upload part is required.");
  }

  return {
    description:
      typeof descriptionEntry === "string" ? descriptionEntry : undefined,
    parts,
    title: typeof titleEntry === "string" ? titleEntry : undefined,
  };
}
