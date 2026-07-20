import "../test/preload.ts";
import { describe, expect, test } from "bun:test";
import { buildPrivacyOptions } from "../privacy/mask";

describe("privacy defaults", () => {
  test("masks all inputs with password override", () => {
    const options = buildPrivacyOptions({});
    expect(options.maskAllInputs).toBe(true);
    expect(options.maskInputOptions?.password).toBe(true);
  });

  test("uses ubr-block as default block class", () => {
    const options = buildPrivacyOptions({});
    expect(options.blockClass).toBe("ubr-block");
    expect(options.ignoreClass).toBe("ubr-block");
  });

  test("includes credit-card selectors and custom maskSelectors", () => {
    const options = buildPrivacyOptions({
      maskSelectors: [".secret-field"],
    });
    expect(options.maskTextSelector).toContain('[autocomplete="cc-number"]');
    expect(options.maskTextSelector).toContain(".secret-field");
  });

  test("allows custom blockClass", () => {
    const options = buildPrivacyOptions({ blockClass: "my-block" });
    expect(options.blockClass).toBe("my-block");
  });
});

describe("createRecorder browser guard", () => {
  test("throws when window is undefined", async () => {
    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      const { createRecorder } = await import("../record");
      expect(() => createRecorder()).toThrow(/browser environment/);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      });
    }
  });
});

describe("exportBufferSnapshot shape", () => {
  test("returns replay, console, and network slices", async () => {
    const { createRecorder, exportBufferSnapshot } = await import("../record");
    const recorder = createRecorder({ bufferSeconds: 60 });
    document.body.innerHTML = "<div id='app'>hello</div>";

    console.warn("test-warning");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const snapshot = exportBufferSnapshot(recorder);
    expect(snapshot.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snapshot.bufferSeconds).toBe(60);
    expect(snapshot.replay).toBeDefined();
    expect(snapshot.replay.eventCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(snapshot.replay.events)).toBe(true);
    expect(Array.isArray(snapshot.console.events)).toBe(true);
    expect(Array.isArray(snapshot.network.events)).toBe(true);

    recorder.dispose();
  }, 15_000);
});

describe("password input masking in replay", () => {
  test("does not leak password value in exported replay events", async () => {
    const { createRecorder, exportBufferSnapshot } = await import("../record");
    const secret = "super-secret-password-123";
    document.body.innerHTML =
      '<form><input type="password" id="pwd" name="password" value="" /></form>';
    const input = document.querySelector<HTMLInputElement>("#pwd");
    expect(input).not.toBeNull();
    input!.value = secret;
    input?.dispatchEvent(new Event("input", { bubbles: true }));

    const recorder = createRecorder({ bufferSeconds: 60 });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const snapshot = exportBufferSnapshot(recorder);
    const serialized = JSON.stringify(snapshot.replay.events);
    expect(serialized.includes(secret)).toBe(false);

    recorder.dispose();
  });
});

describe("console capture", () => {
  test("captures console.warn in exported snapshot", async () => {
    const { createRecorder, exportBufferSnapshot } = await import("../record");
    const recorder = createRecorder({ bufferSeconds: 60 });
    console.warn("capture-core-test-warn");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const snapshot = exportBufferSnapshot(recorder);
    const hasWarn = snapshot.console.events.some((event) =>
      event.payload.some((part) => part.includes("capture-core-test-warn"))
    );
    expect(hasWarn).toBe(true);

    recorder.dispose();
  });
});

describe("network capture with ingest exclusion", () => {
  test("does not record ingest URL traffic", async () => {
    const { createRecorder, exportBufferSnapshot } = await import("../record");
    const recorder = createRecorder({ bufferSeconds: 60 });

    await fetch("https://example.com/api/v1/capture/inline", {
      body: JSON.stringify({ test: true }),
      method: "POST",
    }).catch(() => {});

    await fetch("https://example.com/api/public", { method: "GET" }).catch(
      () => {}
    );

    await new Promise((resolve) => setTimeout(resolve, 150));

    const snapshot = exportBufferSnapshot(recorder);
    const urls = snapshot.network.events.flatMap((event) =>
      event.requests.map((request) => request.name)
    );
    expect(urls.some((url) => url.includes("/api/v1/capture/"))).toBe(false);

    recorder.dispose();
  });
});
