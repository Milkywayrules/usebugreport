import { getState, resetState } from "./state";

export function dispose(): void {
  const { recorder } = getState();
  recorder?.dispose();
  resetState();
}
