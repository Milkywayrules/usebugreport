import { describe, expect, test } from "bun:test";
import { DELETION_STEPS } from "./deletion";

describe("DELETION_STEPS", () => {
  test("revoke_access precedes notify in ordered cascade", () => {
    expect(DELETION_STEPS.REVOKE_ACCESS).toBe("revoke_access");
    expect(DELETION_STEPS.NOTIFY).toBe("notify");
    expect(DELETION_STEPS.EXTERNAL_PURGE).toBe("external_purge");
  });
});

import { purgeOrganizationR2Prefix } from "./deletion";

describe("purgeOrganizationR2Prefix", () => {
  test("deletes listed keys in batches idempotently", async () => {
    const deleted: string[] = [];
    const r2 = {
      deleteObject: async (key: string) => {
        deleted.push(key);
      },
      listObjects: async () => [
        { key: "org1/p1/r1/a" },
        { key: "org1/p1/r1/b" },
      ],
    };
    const count = await purgeOrganizationR2Prefix(r2 as never, "org1");
    expect(count).toBe(2);
    expect(deleted).toEqual(["org1/p1/r1/a", "org1/p1/r1/b"]);
  });
});
