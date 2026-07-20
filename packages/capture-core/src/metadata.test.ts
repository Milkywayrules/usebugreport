import "./test/preload.ts";
import { afterEach, describe, expect, test } from "bun:test";
import {
  clearMetadataProvider,
  collectEnvironmentMetadata,
  registerMetadataProvider,
} from "./metadata";

afterEach(() => {
  clearMetadataProvider();
});

describe("collectEnvironmentMetadata", () => {
  test("returns all required keys with happy-dom defaults", async () => {
    const metadata = await collectEnvironmentMetadata();

    expect(metadata.url).toBe(window.location.href);
    expect(metadata.referrer).toBe(document.referrer ?? "");
    expect(metadata.viewport.width).toBe(window.innerWidth);
    expect(metadata.viewport.height).toBe(window.innerHeight);
    expect(metadata.devicePixelRatio).toBe(window.devicePixelRatio ?? 1);
    expect(metadata.userAgent).toBe(navigator.userAgent);
    expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(metadata.locale).toBe(navigator.language);
    expect(metadata.timezone).toBeTruthy();
    expect(metadata.browser.name).toBeTruthy();
    expect(metadata.browser.version).toBeTruthy();
    expect(metadata.os.name).toBeTruthy();
  });

  test("metadataProvider merges into custom without overwriting url", async () => {
    const metadata = await collectEnvironmentMetadata({
      metadataProvider: () => ({
        releaseId: "rel-1.0",
        url: "https://evil.example/override",
        userId: "user-123",
      }),
    });

    expect(metadata.url).toBe(window.location.href);
    expect(metadata.custom?.userId).toBe("user-123");
    expect(metadata.custom?.releaseId).toBe("rel-1.0");
    expect(metadata.custom?.url).toBeUndefined();
  });

  test("registerMetadataProvider merges with config provider", async () => {
    registerMetadataProvider(() => ({ workspaceId: "ws-1" }));

    const metadata = await collectEnvironmentMetadata({
      metadataProvider: () => ({ userId: "user-456" }),
    });

    expect(metadata.custom?.workspaceId).toBe("ws-1");
    expect(metadata.custom?.userId).toBe("user-456");
  });

  test("throws outside browser environment", async () => {
    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      const { collectEnvironmentMetadata: collect } = await import(
        "./metadata"
      );
      await expect(collect()).rejects.toThrow(/browser environment/);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      });
    }
  });
});
