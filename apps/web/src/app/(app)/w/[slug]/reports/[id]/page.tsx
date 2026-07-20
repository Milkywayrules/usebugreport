import { Container } from "@mantine/core";
import { notFound } from "next/navigation";
import { ReportDetailView } from "@/components/report-detail/ReportDetailView";
import {
  ensureActiveOrganization,
  fetchWorkspaces,
} from "@/lib/api-server";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const { data: workspaces } = await fetchWorkspaces();
  const workspace = workspaces.find((row) => row.slug === slug);

  if (!workspace) {
    notFound();
  }

  await ensureActiveOrganization(workspace.id);

  return (
    <Container py="xl">
      <ReportDetailView reportId={id} workspaceSlug={slug} />
    </Container>
  );
}
