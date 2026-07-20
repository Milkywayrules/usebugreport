import type { LogLevel } from "@rrweb/rrweb-plugin-console-record";
import { getRecordConsolePlugin } from "@rrweb/rrweb-plugin-console-record";

const CAPTURED_CONSOLE_LEVELS: LogLevel[] = ["log", "warn", "error"];

/** Console levels captured by default (AC-6). */
export function createConsolePlugin() {
  return getRecordConsolePlugin({
    level: CAPTURED_CONSOLE_LEVELS,
    logger: "console",
  });
}
