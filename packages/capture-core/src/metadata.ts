import type { EnvironmentMetadata } from "./types";

let registeredMetadataProvider: (() => Record<string, unknown>) | undefined;

const UA_EDGE = /Edg\//;
const UA_EDGE_VERSION = /Edg\/([\d.]+)/;
const UA_CHROME = /Chrome\//;
const UA_CHROMIUM = /Chromium\//;
const UA_CHROME_VERSION = /Chrome\/([\d.]+)/;
const UA_FIREFOX = /Firefox\//;
const UA_FIREFOX_VERSION = /Firefox\/([\d.]+)/;
const UA_SAFARI = /Safari\//;
const UA_VERSION = /Version\//;
const UA_VERSION_NUMBER = /Version\/([\d.]+)/;
const UA_WINDOWS = /Windows NT ([\d.]+)/;
const UA_MAC = /Mac OS X ([\d_]+)/;
const UA_ANDROID = /Android ([\d.]+)/;
const UA_IOS_PHONE = /iPhone OS ([\d_]+)/;
const UA_IOS_PAD = /iPad; CPU OS ([\d_]+)/;
const UA_IOS_VERSION = /(?:iPhone OS|CPU OS) ([\d_]+)/;
const UA_LINUX = /Linux/;
const UA_NOT_BRAND = /Not/;
const UNDERSCORE = /_/g;

export interface CollectEnvironmentMetadataOptions {
  metadataProvider?: () => Record<string, unknown>;
}

/** Register a module-level metadata provider (E1-S4 init parity). */
export function registerMetadataProvider(
  fn: () => Record<string, unknown>
): void {
  registeredMetadataProvider = fn;
}

/** Clear the module-level provider (test helper). */
export function clearMetadataProvider(): void {
  registeredMetadataProvider = undefined;
}

function parseBrowserFromUa(userAgent: string): {
  name: string;
  version: string;
} {
  const ua = userAgent;
  if (UA_EDGE.test(ua)) {
    const match = ua.match(UA_EDGE_VERSION);
    return { name: "Edge", version: match?.[1] ?? "unknown" };
  }
  if (UA_CHROME.test(ua) && !UA_CHROMIUM.test(ua)) {
    const match = ua.match(UA_CHROME_VERSION);
    return { name: "Chrome", version: match?.[1] ?? "unknown" };
  }
  if (UA_FIREFOX.test(ua)) {
    const match = ua.match(UA_FIREFOX_VERSION);
    return { name: "Firefox", version: match?.[1] ?? "unknown" };
  }
  if (UA_SAFARI.test(ua) && UA_VERSION.test(ua)) {
    const match = ua.match(UA_VERSION_NUMBER);
    return { name: "Safari", version: match?.[1] ?? "unknown" };
  }
  return { name: "unknown", version: "unknown" };
}

function parseOsFromUa(userAgent: string): { name: string; version?: string } {
  const ua = userAgent;
  if (UA_WINDOWS.test(ua)) {
    const match = ua.match(UA_WINDOWS);
    return { name: "Windows", version: match?.[1] };
  }
  if (UA_MAC.test(ua)) {
    const match = ua.match(UA_MAC);
    return {
      name: "macOS",
      version: match?.[1]?.replace(UNDERSCORE, "."),
    };
  }
  if (UA_ANDROID.test(ua)) {
    const match = ua.match(UA_ANDROID);
    return { name: "Android", version: match?.[1] };
  }
  if (UA_IOS_PHONE.test(ua) || UA_IOS_PAD.test(ua)) {
    const match = ua.match(UA_IOS_VERSION);
    return { name: "iOS", version: match?.[1]?.replace(UNDERSCORE, ".") };
  }
  if (UA_LINUX.test(ua)) {
    return { name: "Linux" };
  }
  return { name: "unknown" };
}

async function enrichFromUserAgentData(
  metadata: EnvironmentMetadata
): Promise<EnvironmentMetadata> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
      getHighEntropyValues?: (hints: string[]) => Promise<{
        fullVersionList?: Array<{ brand: string; version: string }>;
        platform?: string;
        platformVersion?: string;
      }>;
      platform?: string;
    };
  };

  const uaData = nav.userAgentData;
  if (!uaData) {
    return metadata;
  }

  if (uaData.brands?.length) {
    const primary =
      uaData.brands.find((b) => !UA_NOT_BRAND.test(b.brand)) ??
      uaData.brands[0];
    if (primary) {
      metadata.browser = { name: primary.brand, version: primary.version };
    }
  }

  if (uaData.platform) {
    metadata.os = { ...metadata.os, name: uaData.platform };
  }

  if (typeof uaData.getHighEntropyValues === "function") {
    try {
      const hints = await uaData.getHighEntropyValues([
        "platform",
        "platformVersion",
        "fullVersionList",
      ]);
      if (hints.platform) {
        metadata.os = {
          ...metadata.os,
          name: hints.platform,
          version: hints.platformVersion ?? metadata.os.version,
        };
      }
      const brand = hints.fullVersionList?.find(
        (b) => !UA_NOT_BRAND.test(b.brand)
      );
      if (brand) {
        metadata.browser = { name: brand.brand, version: brand.version };
      }
    } catch {
      // UA-CH denied or unavailable — keep UA parse fallback
    }
  }

  return metadata;
}

function readConnectionMetadata():
  | EnvironmentMetadata["connection"]
  | undefined {
  const nav = navigator as Navigator & {
    connection?: {
      downlink?: number;
      effectiveType?: string;
      rtt?: number;
    };
  };
  const { connection } = nav;
  if (!connection) {
    return;
  }
  return {
    downlink: connection.downlink,
    effectiveType: connection.effectiveType,
    rtt: connection.rtt,
  };
}

function mergeCustomMetadata(
  base: EnvironmentMetadata,
  providers: Array<(() => Record<string, unknown>) | undefined>
): EnvironmentMetadata {
  const custom: Record<string, unknown> = { ...base.custom };

  for (const provider of providers) {
    if (!provider) {
      continue;
    }
    const values = provider();
    for (const [key, value] of Object.entries(values)) {
      if (key in base && key !== "custom") {
        continue;
      }
      custom[key] = value;
    }
  }

  if (Object.keys(custom).length === 0) {
    const { custom: _removed, ...rest } = base;
    return rest;
  }

  return { ...base, custom };
}

/**
 * Collect environment metadata at submit time (FR-3).
 * System fields are never overwritten by integrator hooks unless namespaced under `custom`.
 */
export async function collectEnvironmentMetadata(
  options: CollectEnvironmentMetadataOptions = {}
): Promise<EnvironmentMetadata> {
  if (typeof window === "undefined") {
    throw new Error(
      "collectEnvironmentMetadata requires a browser environment (window is undefined)"
    );
  }

  const { userAgent } = navigator;
  const base: EnvironmentMetadata = {
    browser: parseBrowserFromUa(userAgent),
    devicePixelRatio: window.devicePixelRatio ?? 1,
    locale: navigator.language ?? "en-US",
    os: parseOsFromUa(userAgent),
    referrer: document.referrer ?? "",
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    url: window.location.href,
    userAgent,
    viewport: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
  };

  const connection = readConnectionMetadata();
  if (connection) {
    base.connection = connection;
  }

  const enriched = await enrichFromUserAgentData(base);
  return mergeCustomMetadata(enriched, [
    registeredMetadataProvider,
    options.metadataProvider,
  ]);
}
