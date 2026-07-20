import { Title } from "@mantine/core";

export default function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main style={{ padding: "2rem" }}>
      <Title order={2}>Workspace</Title>
      <WorkspaceSlug slugPromise={params} />
    </main>
  );
}

async function WorkspaceSlug({
  slugPromise,
}: {
  slugPromise: Promise<{ slug: string }>;
}) {
  const { slug } = await slugPromise;
  return <p>Slug: {slug}</p>;
}
