/** Drizzle client placeholder — wired in E2-S1. */
export function createDbClient(_databaseUrl: string) {
  return { status: "stub" as const };
}

export { schemaPlaceholder } from "./schema/index";
