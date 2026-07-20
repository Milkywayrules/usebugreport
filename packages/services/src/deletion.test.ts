import { describe, expect, test } from "bun:test";
import { DELETION_STEPS } from "./deletion";

describe("DELETION_STEPS", () => {
  test("revoke_access precedes notify in ordered cascade", () => {
    expect(DELETION_STEPS.REVOKE_ACCESS).toBe("revoke_access");
    expect(DELETION_STEPS.NOTIFY).toBe("notify");
    expect(DELETION_STEPS.EXTERNAL_PURGE).toBe("external_purge");
  });
});
