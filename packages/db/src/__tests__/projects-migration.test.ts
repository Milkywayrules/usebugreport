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

runMigrationTests("projects migration", () => {
  const databaseUrl = process.env.DATABASE_URL as string;

  test("applies projects, ingest_keys, user_preferences tables", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const { execSync } = await import("node:child_process");
      execSync("bun run db:migrate", {
        cwd: new URL("../..", import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      });

      const tables = await listPublicTables(client);

      expect(tables).toContain("projects");
      expect(tables).toContain("ingest_keys");
      expect(tables).toContain("user_preferences");
    } finally {
      await client.end();
    }
  });

  test("indexes include org slug unique, active ingest key partial unique, reports org/project/created", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const projectIndexes = await listIndexes(client, "projects");
      const ingestIndexes = await listIndexes(client, "ingest_keys");
      const reportIndexes = await listIndexes(client, "reports");

      expect(projectIndexes.map((row) => String(row.indexname))).toContain(
        "projects_org_slug_uidx"
      );

      const ingestDefs = ingestIndexes
        .map((row) => String(row.indexdef))
        .join("\n");
      expect(ingestIndexes.map((row) => String(row.indexname))).toContain(
        "ingest_keys_active_project_uidx"
      );
      expect(ingestDefs).toMatch(ACTIVE_KEY_PARTIAL_PATTERN);

      expect(reportIndexes.map((row) => String(row.indexname))).toContain(
        "reports_org_project_created_idx"
      );
    } finally {
      await client.end();
    }
  });

  test("reports.project_id references projects.id", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const rows = await client`
        select
          tc.constraint_name,
          ccu.table_name as foreign_table_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_name = 'reports'
          and kcu.column_name = 'project_id'
      `;

      expect(rows.length).toBeGreaterThan(0);
      expect(String(rows[0]?.foreign_table_name)).toBe("projects");
    } finally {
      await client.end();
    }
  });
});
