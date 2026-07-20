export function buildWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  const hmac = new Bun.CryptoHasher("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

export function webhookTimestampSeconds(now = new Date()): string {
  return String(Math.floor(now.getTime() / 1000));
}
