import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ServiceError } from "./types";

function ipv4ToInt(octets: number[]): number {
  return (
    ((octets[0] ?? 0) << 24) |
    ((octets[1] ?? 0) << 16) |
    ((octets[2] ?? 0) << 8) |
    (octets[3] ?? 0)
  ) >>> 0;
}

function parseIpv4(ip: string): number[] | null {
  if (isIP(ip) !== 4) {
    return null;
  }
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return parts;
}

export function isBlockedIpAddress(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (normalized.startsWith("fe80:")) {
    return true;
  }

  const ipv4 = parseIpv4(normalized);
  if (!ipv4) {
    return false;
  }

  const value = ipv4ToInt(ipv4);
  const first = ipv4[0] ?? 0;
  const second = ipv4[1] ?? 0;

  if (first === 127) {
    return true;
  }
  if (first === 10) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 169 && second === 254) {
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }
  if (normalized === "169.254.169.254") {
    return true;
  }

  return value === ipv4ToInt([169, 254, 169, 254]);
}

export async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname];
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertWebhookHostSafe(hostname: string): Promise<string> {
  const addresses = await resolveHostAddresses(hostname);
  if (addresses.length === 0) {
    throw new ServiceError("VALIDATION_ERROR", "Webhook hostname did not resolve.");
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Webhook URL resolves to a blocked network range."
      );
    }
  }

  return addresses[0] ?? hostname;
}

export class WebhookSsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSsrfError";
  }
}
