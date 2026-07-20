import { pushReportToLinear } from "./bulk-linear-push-api";

export interface BulkLinearPushSummary {
  failedIds: string[];
  failed: number;
  succeeded: number;
}

export async function bulkPushReportsToLinear(
  reportIds: string[]
): Promise<BulkLinearPushSummary> {
  const results = await Promise.allSettled(
    reportIds.map(async (reportId) => {
      try {
        await pushReportToLinear(reportId);
        return { ok: true as const, reportId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Push failed";
        if (message.includes("Explicit retry")) {
          await pushReportToLinear(reportId, { retry: true });
          return { ok: true as const, reportId };
        }
        throw error;
      }
    })
  );

  const failedIds: string[] = [];
  let succeeded = 0;

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (!result) continue;
    const reportId = reportIds[index] ?? "unknown";
    if (result.status === "fulfilled") {
      succeeded += 1;
    } else {
      failedIds.push(reportId);
    }
  }

  return {
    failed: failedIds.length,
    failedIds,
    succeeded,
  };
}
