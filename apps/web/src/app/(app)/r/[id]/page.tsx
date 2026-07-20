import { Alert, Anchor, Stack, Title } from "@mantine/core";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchReport } from "@/lib/api-server";

export default async function ReportDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id.trim()) {
    return <ReportNotFound reportId={id} />;
  }

  const report = await fetchReport(id);
  if (report) {
    redirect(`/w/${report.workspaceSlug}/reports/${report.id}`);
  }

  return <ReportNotFound reportId={id} />;
}

function ReportNotFound({ reportId }: { reportId: string }) {
  return (
    <Stack maw={480} mx="auto" p="xl">
      <Title order={2}>Report not found</Title>
      <Alert color="red" title="Unable to load report">
        Report {reportId || "unknown"} could not be found or you may not have
        access. Full deep-link resolution requires the reports read API (E2-S5).
      </Alert>
      <Anchor component={Link} href="/settings/workspaces">
        Back to workspaces
      </Anchor>
    </Stack>
  );
}
