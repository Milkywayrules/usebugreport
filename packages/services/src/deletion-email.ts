export interface DeletionEmailPayload {
  organizationSlug: string;
  ownerEmail: string;
  phase: "started" | "complete";
}

export async function sendDeletionLifecycleEmail(
  payload: DeletionEmailPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !payload.ownerEmail) {
    return;
  }

  const subject =
    payload.phase === "complete"
      ? `Workspace "${payload.organizationSlug}" deletion complete`
      : `Workspace "${payload.organizationSlug}" deletion started`;

  const text =
    payload.phase === "complete"
      ? `Deletion for workspace "${payload.organizationSlug}" has finished. Tenant data has been purged per your request.`
      : `Deletion for workspace "${payload.organizationSlug}" has started. You will receive another email when purge completes.`;

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "UseBugReport <onboarding@resend.dev>",
      subject,
      text,
      to: [payload.ownerEmail],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Deletion email failed with status ${response.status}`);
  }
}
