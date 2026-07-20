"use client";

import {
  Alert,
  Button,
  Container,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface OnboardingFormProps {
  createWorkspaceAction: (name: string) => Promise<{
    error?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createWorkspaceAction(workspaceName);
      if (result.error) {
        setError(result.error);
        return;
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
              description="Created in the next step (E4-S3)"
              disabled
              label="Project name"
              mb="md"
              placeholder="Coming soon"
            />

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
