import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const runMigrationTest = hasDatabaseUrl() ? describe : describe.skip;

runMigrationTest("auth migration", () => {
  test("creates auth tables on fresh postgres", async () => {
    applyTestEnv();

    const { initAuth } = await import("../lib/auth");
    initAuth();
    const { db: authDb } = await import("../lib/auth");

    const result = await authDb.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);

    const tableNames = result.map((row) => String(row.table_name)).sort();

    expect(tableNames).toContain("user");
    expect(tableNames).toContain("session");
    expect(tableNames).toContain("account");
    expect(tableNames).toContain("verification");
    expect(tableNames).toContain("organization");
    expect(tableNames).toContain("member");
    expect(tableNames).toContain("invitation");
    expect(tableNames).toContain("apikey");

    expect(tableNames).not.toContain("projects");
    expect(tableNames).not.toContain("ingest_keys");
    expect(tableNames).not.toContain("workspace_api_keys");
    expect(tableNames).not.toContain("reports");
  });
});
