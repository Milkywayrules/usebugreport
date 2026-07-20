import { ReadableStream, WritableStream } from "node:stream/web";
import { gzipSync } from "node:zlib";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

/** Test-only CompressionStream polyfill — production uses browser-native API. */
if (typeof globalThis.CompressionStream === "undefined") {
  globalThis.CompressionStream = class CompressionStream
    implements CompressionStream
  {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    constructor(format: string) {
      if (format !== "gzip") {
        throw new TypeError(`Unsupported compression format: ${format}`);
      }

      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const chunks: Uint8Array[] = [];

      this.readable = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });

      this.writable = new WritableStream<Uint8Array>({
        close() {
          const compressed = gzipSync(Buffer.concat(chunks));
          controller.enqueue(new Uint8Array(compressed));
          controller.close();
        },
        write(chunk) {
          chunks.push(chunk);
        },
      });
    }
  } as typeof CompressionStream;
}
