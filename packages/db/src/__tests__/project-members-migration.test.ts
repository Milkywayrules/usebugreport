import { describe, expect, test } from "bun:test";
import postgres from "postgres";

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

runMigrationTests("project members migration", () => {
  const databaseUrl = process.env.DATABASE_URL as string;

  test("applies project_members table and project_role enum", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const { execSync } = await import("node:child_process");
      execSync("bun run db:migrate", {
        cwd: new URL("../..", import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      });

      const tables = await listPublicTables(client);
      expect(tables).toContain("project_members");

      const enumRows = await client`
        select e.enumlabel
        from pg_type t
        join pg_enum e on t.oid = e.enumtypid
        where t.typname = 'project_role'
        order by e.enumsortorder
      `;
      expect(enumRows.map((row) => String(row.enumlabel))).toEqual([
        "viewer",
        "reporter",
        "developer",
        "admin",
      ]);
    } finally {
      await client.end();
    }
  });

  test("indexes include project_members_user_id_idx", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const indexes = await listIndexes(client, "project_members");
      expect(indexes.map((row) => String(row.indexname))).toContain(
        "project_members_user_id_idx"
      );
    } finally {
      await client.end();
    }
  });

  test("project_members has composite primary key on project_id and user_id", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const rows = await client`
        select kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
        where tc.constraint_type = 'PRIMARY KEY'
          and tc.table_name = 'project_members'
        order by kcu.ordinal_position
      `;

      expect(rows.map((row) => String(row.column_name))).toEqual([
        "project_id",
        "user_id",
      ]);
    } finally {
      await client.end();
    }
  });
});
