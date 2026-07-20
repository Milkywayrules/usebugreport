"use client";

import {
  Alert,
  Anchor,
  Button,
  Code,
  Container,
  Group,
  Loader,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CopyKeyButton } from "@/components/copy-key-button";
import {
  createWorkspaceAction,
  fetchFirstReportIdAction,
} from "./actions";
import { buildSdkSnippet } from "./onboarding-snippet";

interface OnboardingFormProps {
  createWorkspaceAction: typeof createWorkspaceAction;
  fetchFirstReportIdAction: typeof fetchFirstReportIdAction;
  captureApiBaseUrl: string;
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

export function OnboardingForm({
  createWorkspaceAction: createWorkspace,
  fetchFirstReportIdAction: fetchFirstReportId,
  captureApiBaseUrl,
}: OnboardingFormProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("My App");
  const [error, setError] = useState<string | null>(null);
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [step1Complete, setStep1Complete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreateWorkspace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createWorkspace(workspaceName, projectName);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.ingestKeyPlaintext) {
        setIngestKey(result.ingestKeyPlaintext);
      }
      if (result.slug) {
        setWorkspaceSlug(result.slug);
      }

      setStep1Complete(true);
      setActiveStep(1);
      router.refresh();
    });
  };

  useEffect(() => {
    if (activeStep !== 2 || !workspaceSlug) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const reportId = await fetchFirstReportId();
      if (cancelled || !reportId) {
        return;
      }
      router.push(`/w/${workspaceSlug}/reports/${reportId}`);
      router.refresh();
    };

    void poll();
    const interval = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeStep, fetchFirstReportId, router, workspaceSlug]);

  const sdkSnippet =
    ingestKey !== null ? buildSdkSnippet(ingestKey, captureApiBaseUrl) : "";

  return (
    <Container maw={640} py="xl">
      <Title mb="lg" order={2}>
        Welcome to usebugreport
      </Title>

      <Stepper active={activeStep} mb="xl">
        <Stepper.Step description="Create your workspace" label="Workspace">
          <form onSubmit={handleCreateWorkspace}>
            <TextInput
              disabled={step1Complete || isPending}
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
              disabled={step1Complete || isPending}
              label="Project name"
              mb="md"
              onChange={(event) => setProjectName(event.currentTarget.value)}
              placeholder="My App"
              value={projectName}
            />

            {error ? (
              <Alert color="red" mb="md" title="Unable to create workspace">
                {error}
              </Alert>
            ) : null}

            <Button
              disabled={step1Complete}
              loading={isPending}
              type="submit"
            >
              Create workspace
            </Button>
          </form>
        </Stepper.Step>

        <Stepper.Step description="Install the browser SDK" label="Install SDK">
          {ingestKey ? (
            <>
              <Text mb="sm">
                Paste this into your app entry (see{" "}
                <Anchor
                  href="https://www.npmjs.com/package/@usebugreport/browser"
                  rel="noreferrer"
                  target="_blank"
                >
                  @usebugreport/browser
                </Anchor>
                ).
              </Text>
              <Group align="flex-start" gap="sm" mb="md">
                <Code block data-testid="onboarding-sdk-snippet">
                  {sdkSnippet}
                </Code>
                <CopyKeyButton value={sdkSnippet} />
              </Group>
              <Button onClick={() => setActiveStep(2)}>
                I installed the SDK
              </Button>
            </>
          ) : (
            <Text c="dimmed">Complete step 1 to view your SDK snippet.</Text>
          )}
        </Stepper.Step>

        <Stepper.Step description="First captured report" label="First report">
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Waiting for first report…</Text>
          </Group>
          <Text c="dimmed" mt="sm" size="sm">
            Submit a bug from your app; this page checks every 5 seconds.
          </Text>
        </Stepper.Step>
      </Stepper>

      {step1Complete && workspaceSlug ? (
        <Button component={Link} href={`/w/${workspaceSlug}/reports`} variant="subtle">
          Skip to dashboard
        </Button>
      ) : (
        <Button disabled variant="subtle">
          Skip to dashboard
        </Button>
      )}
    </Container>
  );
}
