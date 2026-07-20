import type { Recorder } from "@usebugreport/capture-core";
import type { SubmitResult } from "./types";
import type { WidgetHost } from "./widget";

export interface SdkState {
  apiBaseUrl: string | null;
  onSubmit: ((result: SubmitResult) => void | Promise<void>) | null;
  projectKey: string | null;
  recorder: Recorder | null;
  widgetHost: WidgetHost | null;
}

let state: SdkState = {
  apiBaseUrl: null,
  onSubmit: null,
  projectKey: null,
  recorder: null,
  widgetHost: null,
};

export function getState(): SdkState {
  return state;
}

export function isInitialized(): boolean {
  return state.recorder !== null && state.projectKey !== null;
}

export function setInitialized(next: SdkState): void {
  state = next;
}

export function resetState(): void {
  state.widgetHost?.destroy();
  state = {
    apiBaseUrl: null,
    onSubmit: null,
    projectKey: null,
    recorder: null,
    widgetHost: null,
  };
}
