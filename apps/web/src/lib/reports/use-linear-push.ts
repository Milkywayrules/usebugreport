"use client";

import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { pushReportToLinear } from "./bulk-linear-push-api";
import {
  isLinearPushRetryRequired,
  isLinearTokenExpiredMessage,
} from "./linear-push-errors";

export function useLinearPush(reportId: string) {
  const queryClient = useQueryClient();
  const [tokenExpired, setTokenExpired] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      setTokenExpired(false);
      try {
        return await pushReportToLinear(reportId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Linear push failed.";
        if (isLinearPushRetryRequired(message)) {
          return pushReportToLinear(reportId, { retry: true });
        }
        if (isLinearTokenExpiredMessage(message)) {
          setTokenExpired(true);
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      if (result.status === "succeeded" && result.externalUrl) {
        notifications.show({ color: "green", message: "Pushed to Linear." });
        await queryClient.invalidateQueries({ queryKey: ["report", reportId, "detail"] });
        return;
      }
      notifications.show({ message: "Linear push queued." });
      await queryClient.invalidateQueries({ queryKey: ["report", reportId, "detail"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Linear push failed.";
      if (!isLinearTokenExpiredMessage(message)) {
        notifications.show({ color: "red", message });
      }
    },
  });

  const push = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return {
    clearTokenExpired: () => setTokenExpired(false),
    isPending: mutation.isPending,
    push,
    tokenExpired,
  };
}
