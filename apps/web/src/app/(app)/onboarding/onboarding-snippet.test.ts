import { describe, expect, test } from "bun:test";
import { buildSdkSnippet } from "./onboarding-snippet";

describe("buildSdkSnippet", () => {
  test("includes projectKey and apiBaseUrl", () => {
    const snippet = buildSdkSnippet("ing_live_abc", "https://api.example.com");
    expect(snippet).toContain('projectKey: "ing_live_abc"');
    expect(snippet).toContain('apiBaseUrl: "https://api.example.com"');
    expect(snippet).toContain("@usebugreport/browser");
  });
});
