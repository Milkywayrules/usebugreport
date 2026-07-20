import type { ReportStatusValue } from "@/lib/reports/status";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function patchReportStatus(
  reportId: string,
  status: ReportStatusValue
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/api/v1/reports/${reportId}/status`,
    {
      body: JSON.stringify({ status }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update report ${reportId}`);
  }
}
