"use client";

import {
  Alert,
  Button,
  Code,
  Container,
  Group,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyKeyButton } from "@/components/copy-key-button";

interface OnboardingFormProps {
  createWorkspaceAction: (
    name: string,
    projectName?: string
  ) => Promise<{
    error?: string;
    ingestKeyPlaintext?: string;
    slug?: string;
  }>;
}

function slugPreview(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

export function OnboardingForm({ createWorkspaceAction }: OnboardingFormProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createWorkspaceAction(workspaceName, projectName);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.ingestKeyPlaintext) {
        setIngestKey(result.ingestKeyPlaintext);
      }

      setCompleted(true);
      router.push(result.slug ? `/w/${result.slug}` : "/");
      router.refresh();
    });
  };

  return (
    <Container maw={640} py="xl">
      <Title mb="lg" order={2}>
        Welcome to usebugreport
      </Title>

      <Stepper active={completed ? 1 : 0} mb="xl">
        <Stepper.Step description="Create your workspace" label="Workspace">
          <form onSubmit={handleSubmit}>
            <TextInput
              disabled={completed || isPending}
              label="Workspace name"
              mb="md"
              onChange={(event) => setWorkspaceName(event.currentTarget.value)}
              placeholder="Acme Corp"
              required
              value={workspaceName}
            />

            {workspaceName.trim() ? (
              <Text c="dimmed" mb="md" size="sm">
                Slug preview: {slugPreview(workspaceName)}
              </Text>
            ) : null}

            <TextInput
              disabled={completed || isPending}
              label="Project name"
              mb="md"
              onChange={(event) => setProjectName(event.currentTarget.value)}
              placeholder="Web App"
              value={projectName}
            />

            {ingestKey ? (
              <Alert
                color="blue"
                data-testid="onboarding-ingest-key"
                mb="md"
                title="Ingest key (shown once)"
              >
                <Group align="flex-end" gap="sm">
                  <Code block>{ingestKey}</Code>
                  <CopyKeyButton value={ingestKey} />
                </Group>
              </Alert>
            ) : null}

            {error ? (
              <Alert color="red" mb="md" title="Unable to create workspace">
                {error}
              </Alert>
            ) : null}

            <Button disabled={completed} loading={isPending} type="submit">
              Create workspace
            </Button>
          </form>
        </Stepper.Step>

        <Stepper.Step
          description="SDK snippet — E3-S2"
          disabled
          label="Install SDK"
        >
          <Text c="dimmed">Available after workspace setup.</Text>
        </Stepper.Step>

        <Stepper.Step
          description="First report — E3-S2"
          disabled
          label="First report"
        >
          <Text c="dimmed">Available after SDK install.</Text>
        </Stepper.Step>
      </Stepper>

      <Button disabled variant="subtle">
        Skip to dashboard
      </Button>
    </Container>
  );
}
