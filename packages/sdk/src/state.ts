import type { Recorder } from "@usebugreport/capture-core";
import type { SubmitResult } from "./types";

export interface SdkState {
  onSubmit: ((result: SubmitResult) => void | Promise<void>) | null;
  projectKey: string | null;
  recorder: Recorder | null;
}

let state: SdkState = {
  onSubmit: null,
  projectKey: null,
  recorder: null,
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
  state = {
    onSubmit: null,
    projectKey: null,
    recorder: null,
  };
}
