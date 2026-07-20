import { assertWebhookHostSafe, WebhookSsrfError } from "./webhook-ssrf";

export interface WebhookHttpResult {
  responseCode: number | null;
  ssrfBlocked?: boolean;
}

export async function postWebhookPayload(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<WebhookHttpResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { responseCode: null };
  }

  if (parsed.protocol !== "https:") {
    return { responseCode: null };
  }

  let pinnedIp: string;
  try {
    pinnedIp = await assertWebhookHostSafe(parsed.hostname);
  } catch {
    return { responseCode: null, ssrfBlocked: true };
  }

  const pinnedUrl = new URL(parsed.toString());
  pinnedUrl.hostname = pinnedIp.includes(":") ? `[${pinnedIp}]` : pinnedIp;

  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), 5_000);
  const totalTimeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(pinnedUrl, {
      body,
      headers: {
        "Content-Type": "application/json",
        Host: parsed.hostname,
        ...headers,
      },
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      tls: {
        serverName: parsed.hostname,
      },
    });
    return { responseCode: response.status };
  } catch (error) {
    if (error instanceof WebhookSsrfError) {
      return { responseCode: null, ssrfBlocked: true };
    }
    return { responseCode: null };
  } finally {
    clearTimeout(connectTimeout);
    clearTimeout(totalTimeout);
  }
}
