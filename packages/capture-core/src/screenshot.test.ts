/**
 * Screenshot tests — happy-dom limitations:
 * - Canvas toBlob('image/webp') may return null or use PNG fallback
 * - html-to-image DOM rendering is partial in happy-dom
 * We assert privacy hook wiring, config flags, and call contracts — not pixel fidelity.
 */
import "./test/preload.ts";
import { describe, expect, mock, test } from "bun:test";
import {
  buildScreenshotPrivacyHooks,
  captureScreenshot,
  maskInputElements,
  maskSelectorElements,
  prepareScreenshotClone,
} from "./screenshot";

describe("buildScreenshotPrivacyHooks", () => {
  test("filter excludes ubr-block subtrees", () => {
    document.body.innerHTML =
      '<div id="visible">ok</div><div class="ubr-block" id="blocked">secret</div>';
    const { filter } = buildScreenshotPrivacyHooks({});

    const visible = document.getElementById("visible");
    const blocked = document.getElementById("blocked");
    expect(visible).toBeTruthy();
    expect(blocked).toBeTruthy();
    expect(filter(visible!)).toBe(true);
    expect(filter(blocked!)).toBe(false);
  });
});

describe("privacy masking on clone", () => {
  test("prepareScreenshotClone removes blocked nodes and masks inputs", () => {
    document.body.innerHTML =
      '<div id="app"><input id="secret" value="plain-text" />' +
      '<div class="ubr-block" id="blocked">hidden</div></div>';

    const clone = prepareScreenshotClone({});
    try {
      expect(clone.querySelector("#blocked")).toBeNull();
      const input = clone.querySelector("#secret") as HTMLInputElement;
      expect(input.value).toBe("***");
    } finally {
      clone.remove();
    }
  });

  test("maskSelectorElements masks credit-card and custom selectors", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<input autocomplete="cc-number" value="4111111111111111" />' +
      '<input class="secret-field" value="top-secret" />';

    maskSelectorElements(root, '[autocomplete="cc-number"], .secret-field');

    const cc = root.querySelector(
      '[autocomplete="cc-number"]'
    ) as HTMLInputElement;
    const secret = root.querySelector(".secret-field") as HTMLInputElement;
    expect(cc.value).toBe("***");
    expect(secret.value).toBe("***");
  });

  test("maskInputElements masks all inputs", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<input type="text" value="visible" /><textarea>notes</textarea>';
    maskInputElements(root);
    expect((root.querySelector("input") as HTMLInputElement).value).toBe("***");
    expect((root.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "***"
    );
  });
});

describe("captureScreenshot", () => {
  test("returns null when captureScreenshot is false", async () => {
    const result = await captureScreenshot({ captureScreenshot: false });
    expect(result).toBeNull();
  });

  test("invokes html-to-image (mocked) and returns webp blob", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 50;

    mock.module("html-to-image", () => ({
      toCanvas: (_node: HTMLElement, _options?: Record<string, unknown>) =>
        Promise.resolve(canvas),
    }));

    const { captureScreenshot: captureFresh } = await import(
      "./screenshot?bust=1"
    );

    canvas.toBlob = (callback: BlobCallback, type?: string) => {
      callback(new Blob(["webp-bytes"], { type: type ?? "image/webp" }));
    };

    document.body.innerHTML = "<div>content</div>";
    const result = await captureFresh({ captureScreenshot: true });

    expect(result?.contentType).toBe("image/webp");
    expect(result?.blob.type).toContain("webp");

    mock.restore();
  });

  test("throws when canvas.toBlob returns null (happy-dom WebP gap)", async () => {
    const canvas = document.createElement("canvas");
    mock.module("html-to-image", () => ({
      toCanvas: () => Promise.resolve(canvas),
    }));

    const { captureScreenshot: captureFresh } = await import(
      "./screenshot?bust=2"
    );
    canvas.toBlob = (callback: BlobCallback) => {
      callback(null);
    };

    await expect(captureFresh({ captureScreenshot: true })).rejects.toThrow(
      /toBlob returned null/
    );

    mock.restore();
  });
});
