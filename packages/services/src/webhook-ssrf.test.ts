import { describe, expect, test } from "bun:test";
import { assertWebhookHostSafe, isBlockedIpAddress } from "./webhook-ssrf";

describe("webhook SSRF deny ranges", () => {
  test("blocks loopback and RFC1918 addresses", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.10")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("100.64.0.1")).toBe(true);
  });

  test("allows public addresses", () => {
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
    expect(isBlockedIpAddress("1.1.1.1")).toBe(false);
  });

  test("register/deliver guard rejects literal private IP host", async () => {
    await expect(assertWebhookHostSafe("127.0.0.1")).rejects.toThrow(
      /blocked network range/i
    );
  });
});
