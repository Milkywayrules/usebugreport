"use client";

import { Button, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createReportComment,
  fetchReportComments,
} from "@/lib/report-detail/client-api";

export function CommentsPanel({ reportId }: { reportId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const commentsQuery = useQuery({
    queryFn: () => fetchReportComments(reportId),
    queryKey: ["report", reportId, "comments"],
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => createReportComment(reportId, body),
    onError: () => {
      notifications.show({
        color: "red",
        message: "Comment could not be saved.",
        title: "Save failed",
      });
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["report", reportId, "comments"] });
      const previous = queryClient.getQueryData(["report", reportId, "comments"]);
      const optimistic = {
        authorDisplayName: "You",
        body,
        createdAt: new Date().toISOString(),
        id: `optimistic-${Date.now()}`,
        reportId,
      };
      queryClient.setQueryData(["report", reportId, "comments"], (current: unknown) => {
        const typed = current as { canComment: boolean; comments: typeof optimistic[] } | undefined;
        if (!typed) {
          return { canComment: true, comments: [optimistic] };
        }
        return {
          ...typed,
          comments: [...typed.comments, optimistic],
        };
      });
      setDraft("");
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["report", reportId, "comments"] });
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: "Comment added." });
    },
  });

  if (commentsQuery.isLoading) {
    return <Text c="dimmed">Loading comments…</Text>;
  }

  if (commentsQuery.isError) {
    return <Text c="red">Comments could not be loaded.</Text>;
  }

  const { canComment, comments } = commentsQuery.data ?? {
    canComment: false,
    comments: [],
  };

  const trimmed = draft.trim();
  const submitDisabled = !canComment || !trimmed || createMutation.isPending;

  return (
    <Stack gap="md" data-testid="report-comments-panel">
      <Stack gap="sm">
        {comments.length === 0 ? (
          <Text c="dimmed">No comments yet.</Text>
        ) : (
          comments.map((comment) => (
            <Stack gap={2} key={comment.id}>
              <Text fw={600} size="sm">
                {comment.authorDisplayName}
                <Text c="dimmed" component="span" ml="xs" size="xs">
                  {new Date(comment.createdAt).toLocaleString()}
                </Text>
              </Text>
              <Text size="sm">{comment.body}</Text>
            </Stack>
          ))
        )}
      </Stack>
      {canComment ? (
        <Stack gap="xs">
          <Textarea
            data-testid="report-comment-input"
            minRows={3}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Add a triage note…"
            value={draft}
          />
          <Button
            data-testid="report-comment-submit"
            disabled={submitDisabled}
            onClick={() => createMutation.mutate(trimmed)}
          >
            Add comment
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
