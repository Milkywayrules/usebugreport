import { describe, expect, test } from "bun:test";
import { ServiceError } from "@usebugreport/services";
import { handleMcpReadTool } from "./mcp-read-handlers";

describe("handleMcpReadTool", () => {
  test("requires reportId for get_report", async () => {
    await expect(
      handleMcpReadTool(
        {
          authContext: {
            organizationId: "org",
            requestId: "req",
            type: "api_key",
          } as never,
          reportService: {} as never,
          searchService: {} as never,
        },
        "get_report",
        {}
      )
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
