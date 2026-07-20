import { describe, expect, test } from "bun:test";
import postgres from "postgres";

const ACTIVE_KEY_PARTIAL_PATTERN = /revoked_at IS NULL/i;

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function listPublicTables(client: postgres.Sql): Promise<string[]> {
  return client`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `.then((rows) => rows.map((row) => String(row.table_name)));
}

function listIndexes(client: postgres.Sql, tableName: string) {
  return client`
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public' and tablename = ${tableName}
    order by indexname
  `;
}

const runMigrationTests = hasDatabaseUrl() ? describe : describe.skip;

runMigrationTests("workspace api keys migration", () => {
  const databaseUrl = process.env.DATABASE_URL as string;

  test("applies workspace_api_keys table", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const { execSync } = await import("node:child_process");
      execSync("bun run db:migrate", {
        cwd: new URL("../..", import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      });

      const tables = await listPublicTables(client);
      expect(tables).toContain("workspace_api_keys");
    } finally {
      await client.end();
    }
  }, 60_000);

  test("indexes include org id and active partial index", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const indexes = await listIndexes(client, "workspace_api_keys");
      const names = indexes.map((row) => String(row.indexname));
      expect(names).toContain("workspace_api_keys_org_id_idx");
      expect(names).toContain("workspace_api_keys_active_org_idx");

      const defs = indexes.map((row) => String(row.indexdef)).join("\n");
      expect(defs).toMatch(ACTIVE_KEY_PARTIAL_PATTERN);
    } finally {
      await client.end();
    }
  });

  test("organization_id references organization.id", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const rows = await client`
        select ccu.table_name as foreign_table_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_name = 'workspace_api_keys'
          and kcu.column_name = 'organization_id'
      `;

      expect(rows.length).toBeGreaterThan(0);
      expect(String(rows[0]?.foreign_table_name)).toBe("organization");
    } finally {
      await client.end();
    }
  });
});
