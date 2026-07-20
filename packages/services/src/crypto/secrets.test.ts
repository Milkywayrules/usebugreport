import { describe, expect, test } from "bun:test";
import { decryptSecret, encryptSecret } from "./secrets";

describe("encryptSecret", () => {
  test("round-trips plaintext", async () => {
    const key = "test-encryption-key-32-characters-min";
    const encrypted = await encryptSecret('{"access_token":"abc"}', key);
    const plain = await decryptSecret(encrypted, key);
    expect(plain).toBe('{"access_token":"abc"}');
  });
});
