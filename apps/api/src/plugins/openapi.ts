import { openapi } from "@elysiajs/openapi";
import type { Elysia } from "elysia";
import { filterPublicOpenApiSpec } from "../lib/openapi-public-filter";
import {
  INTEGRATION_PUBLIC_TAG,
  OPENAPI_EXCLUDED_PATH_PREFIXES,
  ROUTE_TAGS,
} from "../lib/route-tags";

const OPENAPI_EXCLUDE_PATTERNS: (string | RegExp)[] = [
  ...OPENAPI_EXCLUDED_PATH_PREFIXES.map(
    (prefix) =>
      new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/|$)`)
  ),
  /^\/$/,
  /^\/api\/v1\/workspaces(?:\/|$)/,
  /^\/api\/v1\/projects(?:\/|$)/,
  /^\/api\/v1\/user\/preferences$/,
  /^\/api\/v1\/_test\/platform(?:\/|$)/,
];

const OPENAPI_DOCUMENTATION = {
  info: {
    description:
      "Public integration surface for usebugreport. Session BFF and internal routes are excluded.",
    title: "usebugreport API",
    version: "0.0.0",
  },
  tags: [
    {
      description: "Routes exposed to external integrators",
      name: INTEGRATION_PUBLIC_TAG,
    },
    {
      description:
        "Session-authenticated BFF routes (excluded from public spec)",
      name: ROUTE_TAGS.sessionBff,
    },
    {
      description: "Onboarding flows (excluded from public spec)",
      name: ROUTE_TAGS.onboarding,
    },
    {
      description: "Development probes (excluded from public spec)",
      name: ROUTE_TAGS.internalDev,
    },
  ],
} as const;

export const openapiExcludeConfig = {
  paths: OPENAPI_EXCLUDE_PATTERNS,
  staticFile: true,
  tags: [
    ROUTE_TAGS.sessionBff,
    ROUTE_TAGS.onboarding,
    ROUTE_TAGS.internalDev,
    ROUTE_TAGS.ops,
    ROUTE_TAGS.authHandler,
  ],
};

function buildPublicOpenApiSpec() {
  return filterPublicOpenApiSpec({
    components: { schemas: {} },
    info: OPENAPI_DOCUMENTATION.info,
    openapi: "3.0.3",
    paths: {},
    tags: [...OPENAPI_DOCUMENTATION.tags],
  });
}

export function attachOpenapiRoutes(inputApp: Elysia): Elysia {
  return inputApp
    .get("/openapi.json", () => buildPublicOpenApiSpec())
    .get("/openapi/json", ({ redirect }) => redirect("/openapi.json"))
    .use(
      openapi({
        documentation: {
          ...OPENAPI_DOCUMENTATION,
          tags: [...OPENAPI_DOCUMENTATION.tags],
        },
        exclude: openapiExcludeConfig,
        path: "/docs",
        provider: "scalar",
        scalar: {
          url: "/openapi.json",
        },
        specPath: "/openapi/_internal.json",
      })
    ) as unknown as Elysia;
}
