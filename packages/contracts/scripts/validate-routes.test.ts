import { describe, expect, test } from "bun:test";
import { SURFACE_REGISTRY, surfaceRegistryEntrySchema } from "../src/surface-registry.ts";

describe("surface registry", () => {
  test("entries match AD-2 shape", () => {
    for (const entry of SURFACE_REGISTRY) {
      expect(() => surfaceRegistryEntrySchema.parse(entry)).not.toThrow();
    }
  });

  test("comments.create is enabled for agent write", () => {
    const entry = SURFACE_REGISTRY.find((row) => row.id === "comments.create");
    expect(entry?.launchGate).not.toBe(false);
  });
});
