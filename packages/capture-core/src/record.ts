import type { LogData } from "@rrweb/rrweb-plugin-console-record";
import { PLUGIN_NAME as CONSOLE_PLUGIN_NAME } from "@rrweb/rrweb-plugin-console-record";
import type { NetworkData, RecordPlugin } from "@rrweb/types";
import { EventType, type eventWithTime, type pluginEvent } from "@rrweb/types";
import { record } from "rrweb";
import { CircularReplayBuffer } from "./buffer/circular-buffer";
import { createConsolePlugin } from "./plugins/console";
import { createNetworkPlugin } from "./plugins/network";
import { buildPrivacyOptions } from "./privacy/mask";
import {
  type BufferSnapshot,
  type CaptureCoreConfig,
  type ConsoleSnapshotEvent,
  DEFAULT_BUFFER_SECONDS,
  type ExportBufferSnapshotOptions,
  MAX_BUFFER_SECONDS,
  MIN_BUFFER_SECONDS,
  type NetworkSnapshotEvent,
  type Recorder,
  type ResolvedCaptureCoreConfig,
} from "./types";
import { PLUGIN_NAME as NETWORK_PLUGIN_NAME } from "./vendor/rrweb-plugin-network-record";

export function resolveBufferSeconds(
  value: number | undefined,
  strict?: boolean
): number {
  if (value === undefined) {
    return DEFAULT_BUFFER_SECONDS;
  }
  if (value >= MIN_BUFFER_SECONDS && value <= MAX_BUFFER_SECONDS) {
    return value;
  }
  if (strict) {
    throw new RangeError(
      `bufferSeconds must be between ${MIN_BUFFER_SECONDS} and ${MAX_BUFFER_SECONDS}, got ${value}`
    );
  }
  return Math.min(MAX_BUFFER_SECONDS, Math.max(MIN_BUFFER_SECONDS, value));
}

function resolveConfig(
  config: CaptureCoreConfig = {}
): ResolvedCaptureCoreConfig {
  return {
    blockClass: config.blockClass ?? "ubr-block",
    bufferSeconds: resolveBufferSeconds(
      config.bufferSeconds,
      config.strictBufferSeconds
    ),
    captureConsole: config.captureConsole ?? true,
    captureNetwork: config.captureNetwork ?? true,
    ignoreRequestFn: config.ignoreRequestFn,
    maskSelectors: config.maskSelectors,
    networkBodyMaxBytes: config.networkBodyMaxBytes ?? 32_768,
  };
}

/**
 * Checkout interval: half the buffer window, capped at 60s so export merges 1–2 segments
 * for complete replay per rrweb checkout guidance.
 */
export function checkoutEveryNms(bufferSeconds: number): number {
  return Math.min(Math.floor((bufferSeconds * 1000) / 2), 60_000);
}

function isPluginEvent(
  event: eventWithTime
): event is eventWithTime & pluginEvent<unknown> {
  return event.type === EventType.Plugin;
}

function extractPluginPayload<T>(
  event: eventWithTime,
  pluginName: string
): T | null {
  if (!isPluginEvent(event)) {
    return null;
  }
  const data = event.data as pluginEvent<T>["data"];
  if (data.plugin !== pluginName) {
    return null;
  }
  return data.payload;
}

export function createRecorder(config: CaptureCoreConfig = {}): Recorder {
  if (typeof window === "undefined") {
    throw new Error(
      "createRecorder requires a browser environment (window is undefined)"
    );
  }

  const resolved = resolveConfig(config);
  const replayBuffer = new CircularReplayBuffer(resolved.bufferSeconds);
  const consoleEvents: ConsoleSnapshotEvent[] = [];
  const networkEvents: NetworkSnapshotEvent[] = [];

  const plugins: RecordPlugin[] = [];
  if (resolved.captureConsole) {
    plugins.push(createConsolePlugin());
  }
  if (resolved.captureNetwork) {
    plugins.push(createNetworkPlugin(resolved));
  }

  const privacy = buildPrivacyOptions(resolved);

  const stopRecord = record({
    checkoutEveryNms: checkoutEveryNms(resolved.bufferSeconds),
    emit(event, isCheckout) {
      if (isPluginEvent(event)) {
        const consolePayload = extractPluginPayload<LogData>(
          event,
          CONSOLE_PLUGIN_NAME
        );
        if (consolePayload) {
          consoleEvents.push({ ...consolePayload, timestamp: event.timestamp });
          return;
        }
        const networkPayload = extractPluginPayload<NetworkData>(
          event,
          NETWORK_PLUGIN_NAME
        );
        if (networkPayload) {
          networkEvents.push({ ...networkPayload, timestamp: event.timestamp });
          return;
        }
      }

      replayBuffer.push(event, isCheckout);
    },
    plugins,
    ...privacy,
  });

  const stop = (): void => {
    stopRecord?.();
  };

  const dispose = (): void => {
    stop();
    replayBuffer.clear();
    consoleEvents.length = 0;
    networkEvents.length = 0;
  };

  const exportSnapshot = (
    options?: ExportBufferSnapshotOptions
  ): BufferSnapshot => {
    const seconds = options?.seconds ?? resolved.bufferSeconds;
    const windowMs = seconds * 1000;
    const replayEvents = replayBuffer.getEventsForWindow(seconds);
    const cutoff =
      replayEvents.length > 0
        ? (replayEvents.at(-1)?.timestamp ?? Date.now()) - windowMs
        : Date.now() - windowMs;

    return {
      bufferSeconds: resolved.bufferSeconds,
      console: {
        events: consoleEvents.filter((event) => event.timestamp >= cutoff),
      },
      exportedAt: new Date().toISOString(),
      network: {
        events: networkEvents.filter((event) => event.timestamp >= cutoff),
      },
      replay: {
        eventCount: replayEvents.length,
        events: replayEvents,
      },
    };
  };

  return {
    dispose,
    exportSnapshot,
    getBufferSeconds: () => resolved.bufferSeconds,
    stop,
  };
}

export function exportBufferSnapshot(
  recorder: Recorder,
  options?: ExportBufferSnapshotOptions
): BufferSnapshot {
  return recorder.exportSnapshot(options);
}
