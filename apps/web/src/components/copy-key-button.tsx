"use client";

import { Button } from "@mantine/core";
import { useCallback, useState } from "react";

interface CopyKeyButtonProps {
  testId?: string;
  value: string;
}

export function CopyKeyButton({ testId, value }: CopyKeyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <Button data-testid={testId} onClick={handleCopy} size="xs" variant="light">
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
