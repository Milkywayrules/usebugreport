import { assembleSubmitPayload } from "@usebugreport/capture-core";
import {
  UseBugReportIngestError,
  uploadCapturePayload,
} from "../ingest-client";
import { getState } from "../state";
import type { SubmitResult } from "../types";
import { WIDGET_STYLES } from "./styles";

export interface SubmitWidgetContext {
  apiBaseUrl: string;
  onComplete?: (result: SubmitResult) => void | Promise<void>;
}

function quotaMessage(error: UseBugReportIngestError): string {
  if (error.httpStatus === 429) {
    return `${error.message} Upgrade your workspace plan to increase monthly report limits.`;
  }
  if (error.httpStatus === 401) {
    return "Ingest key was rejected. Verify projectKey and try again.";
  }
  return error.message;
}

export function openSubmitModal(ctx: SubmitWidgetContext): () => void {
  const { apiBaseUrl, onComplete } = ctx;
  const { projectKey, recorder } = getState();
  if (!(projectKey && recorder)) {
    throw new Error("SDK must be initialized before opening submit widget");
  }

  const host = document.createElement("div");
  host.setAttribute("data-usebugreport-widget", "modal");
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = WIDGET_STYLES;
  shadow.append(style);

  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Report a bug</h2>
    <div class="field">
      <label for="ubr-title">Title</label>
      <input id="ubr-title" name="title" type="text" required maxlength="200" placeholder="What went wrong?" />
    </div>
    <div class="field">
      <label for="ubr-description">Description</label>
      <textarea id="ubr-description" name="description" placeholder="Steps to reproduce (optional)"></textarea>
    </div>
    <div class="actions">
      <button type="button" class="secondary" data-action="cancel">Cancel</button>
      <button type="button" class="primary" data-action="submit">Submit</button>
    </div>
    <p class="error" hidden data-role="error"></p>
  `;

  overlay.append(panel);
  shadow.append(overlay);
  document.body.append(host);

  const titleInput = shadow.querySelector("#ubr-title") as HTMLInputElement;
  const descriptionInput = shadow.querySelector(
    "#ubr-description"
  ) as HTMLTextAreaElement;
  const errorEl = shadow.querySelector(
    '[data-role="error"]'
  ) as HTMLParagraphElement;
  const submitButton = shadow.querySelector(
    '[data-action="submit"]'
  ) as HTMLButtonElement;
  const cancelButton = shadow.querySelector(
    '[data-action="cancel"]'
  ) as HTMLButtonElement;

  const close = () => {
    host.remove();
  };

  cancelButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  submitButton.addEventListener("click", async () => {
    errorEl.hidden = true;
    const title = titleInput.value.trim();
    if (!title) {
      errorEl.textContent = "Title is required.";
      errorEl.hidden = false;
      titleInput.focus();
      return;
    }

    submitButton.disabled = true;
    cancelButton.disabled = true;

    try {
      const description = descriptionInput.value.trim() || undefined;
      const payload = await assembleSubmitPayload(recorder);
      const upload = await uploadCapturePayload({
        apiBaseUrl,
        description,
        payload,
        projectKey,
        title,
      });

      const result: SubmitResult = {
        description,
        payload,
        projectKey,
        reportId: upload.reportId,
        title,
      };

      await onComplete?.(result);
      close();
    } catch (error) {
      if (error instanceof UseBugReportIngestError) {
        errorEl.textContent = quotaMessage(error);
      } else if (error instanceof Error) {
        errorEl.textContent = error.message;
      } else {
        errorEl.textContent = "Submit failed.";
      }
      errorEl.hidden = false;
    } finally {
      submitButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  titleInput.focus();
  return close;
}
