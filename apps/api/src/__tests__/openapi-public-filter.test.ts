import { describe, expect, test } from "bun:test";
import { filterPublicOpenApiSpec } from "../lib/openapi-public-filter";
import { INTEGRATION_PUBLIC_TAG } from "../lib/route-tags";

describe("filterPublicOpenApiSpec", () => {
  test("keeps only integration-public tagged operations", () => {
    const spec = filterPublicOpenApiSpec({
      info: { title: "test", version: "0.0.0" },
      openapi: "3.0.3",
      paths: {
        "/api/v1/reports": {
          get: { tags: [INTEGRATION_PUBLIC_TAG] },
        },
        "/health": {
          get: { tags: ["ops"] },
        },
      },
      tags: [{ name: INTEGRATION_PUBLIC_TAG }],
    });

    expect(spec.paths?.["/health"]).toBeUndefined();
    expect(spec.paths?.["/api/v1/reports"]?.get?.tags).toEqual([
      INTEGRATION_PUBLIC_TAG,
    ]);
  });
});
