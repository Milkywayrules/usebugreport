/**
 * Screenshot capture via html-to-image (preferred over html2canvas for bundle size).
 * WebP encoding uses canvas.toBlob; happy-dom may stub canvas/WebP — see screenshot.test.ts.
 */
import { toCanvas } from "html-to-image";
import { buildPrivacyOptions } from "./privacy/mask";
import type {
  CaptureCoreConfig,
  ResolvedCaptureCoreConfig,
  ScreenshotCaptureResult,
} from "./types";

/** Default WebP quality (not integrator-facing in v1). */
export const DEFAULT_WEBP_QUALITY = 0.85;

const MASKED_VALUE = "***";

export interface CaptureScreenshotOptions {
  blockClass?: string;
  captureScreenshot?: boolean;
  maskSelectors?: string[];
  screenshotMode?: "viewport" | "fullPage";
}

function resolveScreenshotConfig(
  config: CaptureScreenshotOptions | ResolvedCaptureCoreConfig
): Required<
  Pick<CaptureScreenshotOptions, "captureScreenshot" | "screenshotMode">
> &
  Pick<CaptureScreenshotOptions, "blockClass" | "maskSelectors"> {
  return {
    blockClass: config.blockClass ?? "ubr-block",
    captureScreenshot: config.captureScreenshot ?? true,
    maskSelectors: config.maskSelectors,
    screenshotMode: config.screenshotMode ?? "viewport",
  };
}

function resolveBlockClass(
  config: Pick<CaptureCoreConfig, "blockClass" | "maskSelectors">
): { blockClass: string; maskTextSelector: string } {
  const privacy = buildPrivacyOptions(config);
  const blockClass =
    typeof privacy.blockClass === "string" ? privacy.blockClass : "ubr-block";
  return {
    blockClass,
    maskTextSelector: privacy.maskTextSelector ?? "",
  };
}

function hasBlockedAncestor(node: Node, blockClass: string): boolean {
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element && current.classList.contains(blockClass)) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

export function maskInputElements(root: ParentNode): void {
  for (const input of Array.from(root.querySelectorAll("input, textarea"))) {
    if (
      input instanceof HTMLInputElement ||
      input instanceof HTMLTextAreaElement
    ) {
      input.value = MASKED_VALUE;
    }
  }
}

export function maskSelectorElements(
  root: ParentNode,
  maskTextSelector: string
): void {
  for (const el of Array.from(root.querySelectorAll(maskTextSelector))) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = MASKED_VALUE;
    } else {
      el.textContent = MASKED_VALUE;
    }
  }
}

function removeBlockedSubtrees(root: ParentNode, blockClass: string): void {
  for (const el of Array.from(root.querySelectorAll(`.${blockClass}`))) {
    el.remove();
  }
}

/**
 * Build a detached DOM clone with privacy masks applied (FR-2).
 * html-to-image has no onclone hook — we mask a clone to avoid mutating live DOM/replay.
 */
export function prepareScreenshotClone(
  config: Pick<CaptureCoreConfig, "blockClass" | "maskSelectors">
): HTMLElement {
  const { blockClass, maskTextSelector } = resolveBlockClass(config);
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  removeBlockedSubtrees(clone, blockClass);
  maskInputElements(clone);
  if (maskTextSelector) {
    maskSelectorElements(clone, maskTextSelector);
  }

  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  document.body.appendChild(clone);
  return clone;
}

export function buildScreenshotPrivacyHooks(
  config: Pick<CaptureCoreConfig, "blockClass" | "maskSelectors">
): {
  filter: (node: Node) => boolean;
} {
  const { blockClass } = resolveBlockClass(config);
  return {
    filter: (node: Node): boolean => !hasBlockedAncestor(node, blockClass),
  };
}

function fullPageHeight(): number {
  return Math.max(
    document.body?.scrollHeight ?? 0,
    document.documentElement?.scrollHeight ?? 0,
    document.body?.offsetHeight ?? 0,
    document.documentElement?.offsetHeight ?? 0,
    window.innerHeight
  );
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error("canvas.toBlob returned null (WebP may be unsupported)")
          );
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Capture a WebP screenshot honoring privacy masks (FR-2 / FR-3).
 * Returns null when captureScreenshot is false without throwing.
 */
export async function captureScreenshot(
  options: CaptureScreenshotOptions | ResolvedCaptureCoreConfig = {}
): Promise<ScreenshotCaptureResult | null> {
  if (typeof window === "undefined") {
    throw new Error(
      "captureScreenshot requires a browser environment (window is undefined)"
    );
  }

  const resolved = resolveScreenshotConfig(options);
  if (!resolved.captureScreenshot) {
    return null;
  }

  const pixelRatio = window.devicePixelRatio ?? 1;
  const width = window.innerWidth;
  const height =
    resolved.screenshotMode === "fullPage"
      ? fullPageHeight()
      : window.innerHeight;

  const clone = prepareScreenshotClone(resolved);

  try {
    const canvas = await toCanvas(clone, {
      height,
      pixelRatio,
      width,
    });

    const blob = await canvasToWebpBlob(canvas, DEFAULT_WEBP_QUALITY);

    return {
      blob,
      byteLength: blob.size,
      contentType: "image/webp",
      height: Math.round(height * pixelRatio),
      width: Math.round(width * pixelRatio),
    };
  } finally {
    clone.remove();
  }
}
