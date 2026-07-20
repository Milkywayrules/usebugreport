import { describe, expect, test } from "bun:test";
import { unauthorizedError } from "../lib/errors";
import { requireSession } from "../middleware/session";

describe("session middleware error envelope", () => {
  test("401 uses UNAUTHORIZED envelope with requestId", () => {
    const result = requireSession({
      requestId: "req_test123456",
      session: null,
      user: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(401);
    expect(result.body).toEqual(
      unauthorizedError("Authentication required.", "req_test123456")
    );
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(result.body.error.message).toBeTruthy();
    expect(result.body.error.requestId).toBe("req_test123456");
  });
});
