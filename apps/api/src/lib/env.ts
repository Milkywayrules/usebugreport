import { type Env, parseEnv } from "@usebugreport/config";

import { runtimeEnv } from "../runtime-env";

export type ApiEnv = Env & typeof runtimeEnv;

let cachedEnv: ApiEnv | undefined;

export function getEnv(): ApiEnv {
  if (!cachedEnv) {
    cachedEnv = { ...parseEnv(process.env), ...runtimeEnv };
  }
  return cachedEnv;
}
