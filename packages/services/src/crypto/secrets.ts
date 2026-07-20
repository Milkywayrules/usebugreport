const VERSION = "v1";

function deriveKeyMaterial(encryptionKey: string): Uint8Array {
  const digest = new Bun.CryptoHasher("sha256");
  digest.update(encryptionKey);
  return new Uint8Array(digest.digest());
}

export async function encryptSecret(
  plaintext: string,
  encryptionKey: string
): Promise<string> {
  const keyBytes = deriveKeyMaterial(encryptionKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    cryptoKey,
    encoded
  );
  const cipherBytes = new Uint8Array(cipher);
  const tag = cipherBytes.slice(cipherBytes.length - 16);
  const body = cipherBytes.slice(0, cipherBytes.length - 16);
  return [
    VERSION,
    Buffer.from(iv).toString("base64url"),
    Buffer.from(body).toString("base64url"),
    Buffer.from(tag).toString("base64url"),
  ].join(":");
}

export async function decryptSecret(
  payload: string,
  encryptionKey: string
): Promise<string> {
  const [version, ivB64, bodyB64, tagB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !bodyB64 || !tagB64) {
    throw new Error("Invalid encrypted payload.");
  }

  const keyBytes = deriveKeyMaterial(encryptionKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = Buffer.from(ivB64, "base64url");
  const body = Buffer.from(bodyB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const combined = Buffer.concat([body, tag]);
  const plain = await crypto.subtle.decrypt(
    { iv, name: "AES-GCM" },
    cryptoKey,
    combined
  );
  return new TextDecoder().decode(plain);
}
