import { describe, expect, test } from "bun:test";
import { app } from "../index";
import { quotaExceededToHttp, serviceErrorToHttp } from "../lib/errors";

const requestIdPattern = /^req_/;

describe("platform error envelope", () => {
  test("QUOTA_EXCEEDED maps to HTTP 429", () => {
    const mapped = serviceErrorToHttp(
      {
        code: "QUOTA_EXCEEDED",
        message: "Monthly report quota exceeded.",
      },
      "req_testquota01"
    );

    expect(mapped.status).toBe(429);
    expect(mapped.body.error.code).toBe("QUOTA_EXCEEDED");
  });

  test("quotaExceededToHttp returns 429 envelope", () => {
    const mapped = quotaExceededToHttp(
      "Monthly report quota exceeded.",
      "req_testquota02"
    );
    expect(mapped.status).toBe(429);
    expect(mapped.body.error.code).toBe("QUOTA_EXCEEDED");
  });

  test("CONFLICT maps to HTTP 409", () => {
    const mapped = serviceErrorToHttp(
      {
        code: "CONFLICT",
        message: "Resource conflict.",
      },
      "req_testconflict1"
    );

    expect(mapped.status).toBe(409);
    expect(mapped.body.error.code).toBe("CONFLICT");
  });

  test("forced internal error returns architecture envelope", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/_test/platform/error")
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.requestId).toMatch(requestIdPattern);
  });

  test("responses include X-Request-Id matching envelope requestId on errors", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/_test/platform/error")
    );
    const body = (await response.json()) as {
      error: { requestId: string };
    };
    expect(response.headers.get("X-Request-Id")).toBe(body.error.requestId);
  });

  test("success responses include X-Request-Id header", async () => {
    const response = await app.handle(new Request("http://localhost/"));
    const requestId = response.headers.get("X-Request-Id");
    expect(requestId).toMatch(requestIdPattern);
  });
});
