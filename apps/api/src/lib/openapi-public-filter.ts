import type { OpenAPIV3_1 } from "openapi-types";
import { INTEGRATION_PUBLIC_TAG, isExcludedOpenApiPath } from "./route-tags";

type OpenApiDocument = OpenAPIV3_1.Document;
type PathItem = OpenAPIV3_1.PathItemObject;
type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";

const HTTP_METHODS: HttpMethod[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

function operationHasIntegrationTag(
  operation: OpenAPIV3_1.OperationObject | undefined
): boolean {
  return operation?.tags?.includes(INTEGRATION_PUBLIC_TAG) ?? false;
}

export function filterPublicOpenApiSpec(
  spec: OpenApiDocument
): OpenApiDocument {
  const filteredPaths: Record<string, PathItem> = {};

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (isExcludedOpenApiPath(path)) {
      continue;
    }

    const nextPathItem: PathItem = {};
    let hasOperation = false;

    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operationHasIntegrationTag(operation)) {
        continue;
      }

      nextPathItem[method] = operation;
      hasOperation = true;
    }

    if (hasOperation) {
      filteredPaths[path] = nextPathItem;
    }
  }

  const publicTags = (spec.tags ?? []).filter(
    (tag) => tag.name === INTEGRATION_PUBLIC_TAG
  );

  return {
    ...spec,
    paths: filteredPaths,
    tags: publicTags.length > 0 ? publicTags : spec.tags,
  };
}
