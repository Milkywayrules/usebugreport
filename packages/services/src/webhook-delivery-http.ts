export interface WebhookHttpResult {
  responseCode: number | null;
}

export async function postWebhookPayload(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<WebhookHttpResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      body,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
    });
    return { responseCode: response.status };
  } catch {
    return { responseCode: null };
  } finally {
    clearTimeout(timeout);
  }
}
