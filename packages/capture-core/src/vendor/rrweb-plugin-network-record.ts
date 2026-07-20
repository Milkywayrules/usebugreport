/**
 * MIT License
 *
 * Copyright (c) 2018 rrweb developers
 *
 * Vendored from `@rrweb/rrweb-plugin-network-record` (rrweb 2.x) — package is
 * unpublished on npm (`bun pm view` returns 404). Upstream:
 * https://github.com/rrweb-io/rrweb/tree/master/packages/rrweb-plugin-network-record
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type {
  IWindow,
  listenerHandler,
  NetworkBody,
  NetworkData,
  NetworkHeaders,
  NetworkInitiatorType,
  NetworkRecordOptions,
  NetworkRequest,
  RecordPlugin,
} from "@rrweb/types";
import { patch } from "@rrweb/utils";

export type {
  NetworkBody,
  NetworkData,
  NetworkHeaders,
  NetworkInitiatorType,
  NetworkRecordOptions,
  NetworkRequest,
} from "@rrweb/types";

const defaultNetworkOptions: NetworkRecordOptions = {
  initiatorTypes: [
    "audio",
    "beacon",
    "body",
    "css",
    "early-hint",
    "embed",
    "fetch",
    "frame",
    "iframe",
    "icon",
    "image",
    "img",
    "input",
    "link",
    "navigation",
    "object",
    "ping",
    "script",
    "track",
    "video",
    "xmlhttprequest",
  ],
  recordBody: false,
  recordHeaders: false,
  recordInitialRequests: false,
  transformRequestFn: (request) => request,
};

type networkCallback = (data: NetworkData) => void;

const isNavigationTiming = (
  entry: PerformanceEntry
): entry is PerformanceNavigationTiming => entry.entryType === "navigation";
const isResourceTiming = (
  entry: PerformanceEntry
): entry is PerformanceResourceTiming => entry.entryType === "resource";

type ObservedPerformanceEntry = (
  | PerformanceNavigationTiming
  | PerformanceResourceTiming
) & {
  responseStatus?: number;
};

function getPerformanceEntryInitiatorType(
  entry: ObservedPerformanceEntry
): NetworkInitiatorType {
  return isNavigationTiming(entry)
    ? "navigation"
    : (entry.initiatorType as NetworkInitiatorType);
}

function shouldRecordPerformanceEntry(
  entry: PerformanceEntry,
  options: Required<NetworkRecordOptions>
): entry is ObservedPerformanceEntry {
  return (
    (isNavigationTiming(entry) || isResourceTiming(entry)) &&
    options.initiatorTypes.includes(
      getPerformanceEntryInitiatorType(entry as ObservedPerformanceEntry)
    )
  );
}

function initPerformanceObserver(
  cb: networkCallback,
  win: IWindow,
  options: Required<NetworkRecordOptions>
) {
  if (options.recordInitialRequests) {
    const initialPerformanceEntries = win.performance
      .getEntries()
      .filter((entry): entry is ObservedPerformanceEntry =>
        shouldRecordPerformanceEntry(entry, options)
      );
    cb({
      isInitial: true,
      requests: initialPerformanceEntries.map((entry) => ({
        duration: entry.duration,
        endTime: Math.round(entry.responseEnd),
        entryType: entry.entryType,
        initiatorType: getPerformanceEntryInitiatorType(entry),
        name: entry.name,
        startTime: Math.round(entry.startTime),
        status: "responseStatus" in entry ? entry.responseStatus : undefined,
      })),
    });
  }
  const observer = new win.PerformanceObserver((entries) => {
    const shouldRecordViaPerformanceObserver = (
      entry: ObservedPerformanceEntry
    ) =>
      options.recordBody || options.recordHeaders
        ? entry.initiatorType !== "xmlhttprequest" &&
          entry.initiatorType !== "fetch"
        : true;
    const performanceEntries = entries
      .getEntries()
      .filter(
        (entry): entry is ObservedPerformanceEntry =>
          shouldRecordPerformanceEntry(entry, options) &&
          shouldRecordViaPerformanceObserver(entry)
      );
    cb({
      requests: performanceEntries.map((entry) => ({
        duration: entry.duration,
        endTime: Math.round(entry.responseEnd),
        entryType: entry.entryType,
        initiatorType: getPerformanceEntryInitiatorType(entry),
        name: entry.name,
        startTime: Math.round(entry.startTime),
        status: "responseStatus" in entry ? entry.responseStatus : undefined,
      })),
    });
  });
  observer.observe({ entryTypes: ["navigation", "resource"] });
  return () => {
    observer.disconnect();
  };
}

function shouldRecordHeaders(
  type: "request" | "response",
  recordHeaders: NetworkRecordOptions["recordHeaders"]
) {
  return (
    !!recordHeaders &&
    (typeof recordHeaders === "boolean" || recordHeaders[type])
  );
}

function shouldRecordBody(
  type: "request" | "response",
  recordBody: NetworkRecordOptions["recordBody"],
  headers: NetworkHeaders,
  url?: string | URL | RequestInfo
) {
  function matchesContentType(contentTypes: string[]) {
    const contentTypeHeader = Object.keys(headers).find(
      (key) => key.toLowerCase() === "content-type"
    );
    const contentType = contentTypeHeader && headers[contentTypeHeader];
    return contentTypes.some((ct) => contentType?.includes(ct));
  }
  if (isBlobUrl(url)) {
    return false;
  }
  if (!recordBody) {
    return false;
  }
  if (typeof recordBody === "boolean") {
    return true;
  }
  if (Array.isArray(recordBody)) {
    return matchesContentType(recordBody);
  }
  const recordBodyType = recordBody[type];
  if (typeof recordBodyType === "boolean") {
    return recordBodyType;
  }
  return matchesContentType(recordBodyType);
}

function isRequest(value: unknown): value is Request {
  if (typeof Request === "undefined") {
    return false;
  }
  if (value instanceof Request) {
    return true;
  }
  try {
    return Object.prototype.toString.call(value) === "[object Request]";
  } catch {
    return false;
  }
}

function isBlobUrl(url?: string | URL | RequestInfo) {
  try {
    if (typeof url === "string") {
      return url.startsWith("blob:");
    }
    if (url instanceof URL) {
      return url.protocol === "blob:";
    }
    if (isRequest(url)) {
      return isBlobUrl(url.url);
    }
  } catch {
    //
  }
  return false;
}

function isReadableStreamBody(
  body: unknown
): body is ReadableStream<Uint8Array> {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as ReadableStream<Uint8Array>).getReader === "function" &&
    typeof (body as ReadableStream<Uint8Array>).tee === "function"
  );
}

function stringifyFormData(body: FormData) {
  const searchParams = new URLSearchParams();
  body.forEach((value, key) => {
    searchParams.append(
      key,
      typeof File !== "undefined" && value instanceof File
        ? value.name
        : String(value)
    );
  });
  return searchParams.toString();
}

function readXhrBody(
  body: Document | XMLHttpRequestBodyInit | unknown | null | undefined
): NetworkBody {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return stringifyFormData(body);
  }
  if (typeof Document !== "undefined" && body instanceof Document) {
    return body.textContent;
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return `[rrweb/network] Cannot synchronously read body of type ${body.constructor.name}`;
  }
  if (
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body as ArrayBufferView)
  ) {
    return "[rrweb/network] Cannot read binary body";
  }
  try {
    return JSON.stringify(body);
  } catch {
    return "[rrweb/network] Failed to stringify body";
  }
}

async function readFetchBody(requestOrResponse: Request | Response) {
  return new Promise<NetworkBody>((resolve) => {
    const timeout = setTimeout(
      () => resolve("[rrweb/network] Timeout while reading body"),
      500
    );
    try {
      requestOrResponse
        .clone()
        .text()
        .then(
          (text) => resolve(text),
          (error: unknown) =>
            resolve(`[rrweb/network] Failed to read body: ${String(error)}`)
        )
        .finally(() => clearTimeout(timeout));
    } catch {
      clearTimeout(timeout);
      resolve("[rrweb/network] Failed to read body");
    }
  });
}

async function getRequestPerformanceEntry(
  win: IWindow,
  initiatorType: string,
  url: string,
  after?: number,
  before?: number,
  attempt = 0
): Promise<PerformanceResourceTiming | null> {
  if (attempt > 10) {
    return null;
  }
  const urlPerformanceEntries = win.performance.getEntriesByName(
    url
  ) as PerformanceResourceTiming[];
  const performanceEntry = findLast(
    urlPerformanceEntries,
    (entry) =>
      isResourceTiming(entry) &&
      entry.initiatorType === initiatorType &&
      (!after || entry.startTime >= after) &&
      (!before || entry.startTime <= before)
  );
  if (!performanceEntry) {
    await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    return getRequestPerformanceEntry(
      win,
      initiatorType,
      url,
      after,
      before,
      attempt + 1
    );
  }
  return performanceEntry;
}

function initXhrObserver(
  cb: networkCallback,
  win: IWindow,
  options: Required<NetworkRecordOptions>
): listenerHandler {
  if (!options.initiatorTypes.includes("xmlhttprequest")) {
    return () => {
      //
    };
  }
  const recordRequestHeaders = shouldRecordHeaders(
    "request",
    options.recordHeaders
  );
  const recordResponseHeaders = shouldRecordHeaders(
    "response",
    options.recordHeaders
  );
  const restorePatch = patch(win.XMLHttpRequest.prototype, "open", ((
    originalOpen: typeof XMLHttpRequest.prototype.open
  ) => {
    return function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async = true,
      username?: string | null,
      password?: string | null
    ) {
      const req = new Request(url, { method });
      const networkRequest: Partial<NetworkRequest> = {};
      let after: number | undefined;
      let before: number | undefined;
      const requestHeaders: NetworkHeaders = {};
      const originalSetRequestHeader = this.setRequestHeader.bind(this);
      this.setRequestHeader = (header: string, value: string) => {
        requestHeaders[header] = value;
        return originalSetRequestHeader(header, value);
      };
      if (recordRequestHeaders) {
        networkRequest.requestHeaders = requestHeaders;
      }
      const originalSend = this.send.bind(this);
      this.send = (body) => {
        if (
          shouldRecordBody("request", options.recordBody, requestHeaders, url)
        ) {
          networkRequest.requestBody = readXhrBody(body);
        }
        after = win.performance.now();
        return originalSend(body);
      };
      this.addEventListener("readystatechange", () => {
        if (this.readyState !== this.DONE) {
          return;
        }
        before = win.performance.now();
        const responseHeaders: NetworkHeaders = {};
        const rawHeaders = this.getAllResponseHeaders();
        const headers = rawHeaders.trim().split(/[\r\n]+/);
        headers.forEach((line) => {
          const parts = line.split(": ");
          const header = parts.shift();
          const value = parts.join(": ");
          if (header) {
            responseHeaders[header] = value;
          }
        });
        if (recordResponseHeaders) {
          networkRequest.responseHeaders = responseHeaders;
        }
        if (
          shouldRecordBody("response", options.recordBody, responseHeaders, url)
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          networkRequest.responseBody = readXhrBody(this.response);
        }
        getRequestPerformanceEntry(
          win,
          "xmlhttprequest",
          req.url,
          after,
          before
        )
          .then((entry) => {
            if (!entry) {
              // https://github.com/rrweb-io/rrweb/pull/1105#issuecomment-1953808336
              const requests = prepareRequestWithoutPerformance(
                req,
                networkRequest
              );
              cb({ requests });
              return;
            }

            const requests = prepareRequest(
              entry,
              method,
              this.status,
              networkRequest
            );
            cb({ requests });
          })
          .catch(() => {
            //
          });
      });
      originalOpen.call(this, method, url, async, username, password);
    };
  }) as (...args: unknown[]) => unknown);
  return () => {
    restorePatch();
  };
}

function initFetchObserver(
  cb: networkCallback,
  win: IWindow,
  options: Required<NetworkRecordOptions>
): listenerHandler {
  if (!options.initiatorTypes.includes("fetch")) {
    return () => {
      //
    };
  }
  const recordRequestHeaders = shouldRecordHeaders(
    "request",
    options.recordHeaders
  );
  const recordResponseHeaders = shouldRecordHeaders(
    "response",
    options.recordHeaders
  );
  const restorePatch = patch(win, "fetch", ((originalFetch: typeof fetch) => {
    return async (url: URL | RequestInfo, init?: RequestInit | undefined) => {
      const req = new Request(url, init);
      let res: Response | undefined;
      const networkRequest: Partial<NetworkRequest> = {};
      let after: number | undefined;
      let before: number | undefined;
      try {
        const requestHeaders: NetworkHeaders = {};
        req.headers.forEach((value, header) => {
          requestHeaders[header] = value;
        });
        if (recordRequestHeaders) {
          networkRequest.requestHeaders = requestHeaders;
        }
        if (
          !isReadableStreamBody(init?.body) &&
          shouldRecordBody("request", options.recordBody, requestHeaders, url)
        ) {
          networkRequest.requestBody = await readFetchBody(req);
        }
        after = win.performance.now();
        res = isRequest(url)
          ? await originalFetch(req)
          : await originalFetch(url, init);
        before = win.performance.now();
        const responseHeaders: NetworkHeaders = {};
        res.headers.forEach((value, header) => {
          responseHeaders[header] = value;
        });
        if (recordResponseHeaders) {
          networkRequest.responseHeaders = responseHeaders;
        }
        if (
          shouldRecordBody("response", options.recordBody, responseHeaders, url)
        ) {
          networkRequest.responseBody = await readFetchBody(res);
        }
        return res;
      } finally {
        getRequestPerformanceEntry(win, "fetch", req.url, after, before)
          .then((entry) => {
            if (!entry) {
              // https://github.com/rrweb-io/rrweb/pull/1105#issuecomment-1953808336
              const requests = prepareRequestWithoutPerformance(
                req,
                networkRequest
              );
              cb({ requests });
              return;
            }

            const requests = prepareRequest(
              entry,
              req.method,
              res?.status,
              networkRequest
            );
            cb({ requests });
          })
          .catch(() => {
            //
          });
      }
    };
  }) as (...args: unknown[]) => unknown);
  return () => {
    restorePatch();
  };
}

function initNetworkObserver(
  callback: networkCallback,
  win: IWindow, // top window or in an iframe
  options: NetworkRecordOptions
): listenerHandler {
  if (!("performance" in win)) {
    return () => {
      //
    };
  }
  const networkOptions = (
    options ? { ...defaultNetworkOptions, ...options } : defaultNetworkOptions
  ) as Required<NetworkRecordOptions>;

  const cb: networkCallback = (data) => {
    const requests = data.requests
      .map((request) => networkOptions.transformRequestFn(request))
      .filter(Boolean) as NetworkRequest[];

    if (requests.length > 0 || data.isInitial) {
      callback({ ...data, requests });
    }
  };
  const performanceObserver = initPerformanceObserver(cb, win, networkOptions);
  let xhrObserver: listenerHandler = () => {
    //
  };
  let fetchObserver: listenerHandler = () => {
    //
  };
  if (networkOptions.recordHeaders || networkOptions.recordBody) {
    xhrObserver = initXhrObserver(cb, win, networkOptions);
    fetchObserver = initFetchObserver(cb, win, networkOptions);
  }
  return () => {
    performanceObserver();
    xhrObserver();
    fetchObserver();
  };
}

function prepareRequest(
  entry: PerformanceResourceTiming,
  method: string | undefined,
  status: number | undefined,
  networkRequest: Partial<NetworkRequest>
): NetworkRequest[] {
  const request: NetworkRequest = {
    duration: entry.duration,
    endTime: Math.round(entry.responseEnd),
    entryType: entry.entryType,
    initiatorType: entry.initiatorType as NetworkInitiatorType,
    method,
    name: entry.name,
    requestBody: networkRequest.requestBody,
    requestHeaders: networkRequest.requestHeaders,
    responseBody: networkRequest.responseBody,
    responseHeaders: networkRequest.responseHeaders,
    startTime: Math.round(entry.startTime),
    status,
  };

  return [request];
}

function prepareRequestWithoutPerformance(
  req: Request,
  networkRequest: Partial<NetworkRequest>
): NetworkRequest[] {
  const request: NetworkRequest = {
    method: req.method,
    name: req.url,
    requestBody: networkRequest.requestBody,
    requestHeaders: networkRequest.requestHeaders,
    responseBody: networkRequest.responseBody,
    responseHeaders: networkRequest.responseHeaders,
  };

  return [request];
}

function findLast<T>(
  array: T[],
  predicate: (value: T) => boolean
): T | undefined {
  const length = array.length;
  for (let i = length - 1; i >= 0; i -= 1) {
    const candidate = array[i];
    if (candidate !== undefined && predicate(candidate)) {
      return candidate;
    }
  }
}

export const PLUGIN_NAME = "rrweb/network@1";

export const getRecordNetworkPlugin: (
  options?: NetworkRecordOptions
) => RecordPlugin = (options) => ({
  name: PLUGIN_NAME,
  observer: initNetworkObserver as RecordPlugin["observer"],
  options,
});
