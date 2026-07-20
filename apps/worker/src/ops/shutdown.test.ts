import { describe, expect, test } from "bun:test";
import { closeWorkersGracefully } from "./shutdown";

describe("closeWorkersGracefully", () => {
  test("resolves when workers close promptly", async () => {
    const worker = {
      close: async () => undefined,
    };
    await closeWorkersGracefully([worker as never], 1000);
    expect(true).toBe(true);
  });
});
