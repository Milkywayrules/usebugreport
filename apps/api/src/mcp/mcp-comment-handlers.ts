import type { AuthContext, CommentService } from "@usebugreport/services";
import { ServiceError } from "@usebugreport/services";

export interface McpCommentHandlerDeps {
  authContext: AuthContext;
  commentService: CommentService;
}

function jsonText(data: unknown) {
  return JSON.stringify(data, null, 2);
}

export async function handleMcpCreateComment(
  deps: McpCommentHandlerDeps,
  args: Record<string, unknown>
): Promise<string> {
  const reportId = typeof args.reportId === "string" ? args.reportId : "";
  const body = typeof args.body === "string" ? args.body : "";
  const dedupeKey =
    typeof args.dedupeKey === "string" ? args.dedupeKey : undefined;

  if (!reportId) {
    throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
  }
  if (!body) {
    throw new ServiceError("VALIDATION_ERROR", "body is required.");
  }

  const comment = await deps.commentService.create(deps.authContext, reportId, {
    body,
    dedupeKey,
  });

  return jsonText({
    data: {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    },
  });
}
