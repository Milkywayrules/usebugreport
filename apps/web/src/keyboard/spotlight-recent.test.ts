import { describe, expect, test } from "bun:test";
import { readSpotlightRecent, recordSpotlightRecent } from "./spotlight-recent";

describe("spotlight recent", () => {
  test("stores last five unique action ids", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mock,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: mock },
    });

    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      recordSpotlightRecent(id);
    }

    const recent = readSpotlightRecent();
    expect(recent).toHaveLength(5);
    expect(recent[0]?.actionId).toBe("f");
  });
});
