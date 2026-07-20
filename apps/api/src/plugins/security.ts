import { Elysia } from "elysia";
import { helmet } from "elysia-helmet";

const CAMEL_TO_KEBAB_PATTERN = /[A-Z]/g;
const FIRST_CHAR_PATTERN = /^./;

const scalarCsp = {
  directives: {
    connectSrc: ["'self'", "https:"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'", "https:", "data:"],
    frameAncestors: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
  },
};

function toCspDirective(key: string): string {
  return key
    .replace(CAMEL_TO_KEBAB_PATTERN, (char) => `-${char.toLowerCase()}`)
    .replace(FIRST_CHAR_PATTERN, (char) => char.toLowerCase());
}

export const securityPlugin = new Elysia({ name: "security" })
  .use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      frameguard: { action: "sameorigin" },
      noSniff: true,
      referrerPolicy: { policy: "no-referrer" },
    })
  )
  .onBeforeHandle({ as: "global" }, ({ path, set }) => {
    if (path.startsWith("/docs") || path.startsWith("/openapi")) {
      set.headers["Content-Security-Policy"] = Object.entries(
        scalarCsp.directives
      )
        .map(([key, values]) => `${toCspDirective(key)} ${values.join(" ")}`)
        .join("; ");
    }
  });
