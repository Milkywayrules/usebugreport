export { dispose } from "./dispose";
export { init } from "./init";
export { submit } from "./submit";
export {
  type SubmitOptions,
  type SubmitResult,
  UseBugReportConfigError,
  type UseBugReportInitOptions,
  UseBugReportNotInitializedError,
} from "./types";

import { dispose } from "./dispose";
import { init } from "./init";
import { submit } from "./submit";

export const SDK_VERSION = "0.1.0";

export const useBugReport = {
  dispose,
  init,
  submit,
};
