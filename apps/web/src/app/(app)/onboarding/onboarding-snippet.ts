export function buildSdkSnippet(projectKey: string, apiBaseUrl: string): string {
  return `import { init } from "@usebugreport/browser";

init({
  projectKey: "${projectKey}",
  apiBaseUrl: "${apiBaseUrl}",
  widget: true,
});`;
}
