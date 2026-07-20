import { ServiceError } from "@usebugreport/services";
import { Elysia } from "elysia";
import {
  createRequestId,
  internalError,
  serviceErrorToHttp,
} from "../lib/errors";

export const requestIdPlugin = new Elysia({ name: "request-id" }).derive(
  { as: "global" },
  () => ({
    requestId: createRequestId(),
  })
);

interface RequestContext {
  requestId: string;
}

export const platformErrorPlugin = new Elysia({ name: "platform-error" })
  .onAfterHandle({ as: "global" }, (context) => {
    const { requestId } = context as typeof context & RequestContext;
    context.set.headers["X-Request-Id"] = requestId;
  })
  .onError({ as: "global" }, (context) => {
    const { error, requestId, set } = context as typeof context &
      RequestContext;
    set.headers["X-Request-Id"] = requestId;

    if (error instanceof ServiceError) {
      const mapped = serviceErrorToHttp(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    }

    set.status = 500;
    return internalError(requestId);
  });
