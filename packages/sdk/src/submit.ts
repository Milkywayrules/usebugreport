import { assembleSubmitPayload } from "@usebugreport/capture-core";
import { getState, isInitialized } from "./state";
import type { SubmitOptions, SubmitResult } from "./types";
import { UseBugReportNotInitializedError } from "./types";

function assertBrowserEnvironment(): void {
  if (typeof window === "undefined") {
    throw new Error(
      "submit requires a browser environment (window is undefined)"
    );
  }
}

function mergeSubmitMetadata(
  payload: SubmitResult["payload"],
  title: string,
  description?: string
): SubmitResult["payload"] {
  const custom = {
    ...(payload.parts.meta.json.custom ?? {}),
    title,
    ...(description === undefined ? {} : { description }),
  };

  const metaJson = {
    ...payload.parts.meta.json,
    custom,
  };

  const metaBlob = new Blob([JSON.stringify(metaJson)], {
    type: "application/json",
  });

  return {
    ...payload,
    parts: {
      ...payload.parts,
      meta: {
        blob: metaBlob,
        contentType: "application/json",
        json: metaJson,
      },
    },
  };
}

export async function submit(options: SubmitOptions): Promise<SubmitResult> {
  assertBrowserEnvironment();

  if (!isInitialized()) {
    throw new UseBugReportNotInitializedError(
      "submit() requires init(); call init({ projectKey }) first"
    );
  }

  const { onSubmit, projectKey, recorder } = getState();
  if (!(recorder && projectKey)) {
    throw new UseBugReportNotInitializedError(
      "submit() requires init(); call init({ projectKey }) first"
    );
  }

  const basePayload = await assembleSubmitPayload(recorder);
  const payload = mergeSubmitMetadata(
    basePayload,
    options.title,
    options.description
  );

  const result: SubmitResult = {
    description: options.description,
    payload,
    projectKey,
    title: options.title,
  };

  await onSubmit?.(result);
  return result;
}
