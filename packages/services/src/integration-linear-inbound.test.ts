import { describe, expect, test } from "bun:test";
import { mapLinearStateToReportStatus } from "./integration-linear-inbound";

describe("linear inbound status mapping", () => {
  test("maps completed type to resolved by default", () => {
    expect(mapLinearStateToReportStatus("Done", "completed", {})).toBe(
      "resolved"
    );
  });

  test("prefers workspace mapping overrides", () => {
    expect(
      mapLinearStateToReportStatus("done", "completed", {
        statusMapping: { done: "closed" },
      })
    ).toBe("closed");
  });
});
