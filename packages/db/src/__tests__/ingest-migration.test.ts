import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { reports } from "../schema/ingest";

const GIN_INDEX_PATTERN = /gin/i;
const IDEMPOTENCY_PARTIAL_PATTERN = /idempotency_key IS NOT NULL/i;

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

runMigrationTests("ingest migration", () => {
  const databaseUrl = process.env.DATABASE_URL as string;

  test("applies auth + ingest tables on fresh postgres", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const { execSync } = await import("node:child_process");
      execSync("bun run db:migrate", {
        cwd: new URL("../..", import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      });

      const tables = await listPublicTables(client);

      expect(tables).toContain("user");
      expect(tables).toContain("organization");
      expect(tables).toContain("reports");
      expect(tables).toContain("report_blobs");
      expect(tables).toContain("workspace_usage_monthly");
    } finally {
      await client.end();
    }
  });

  test("reports indexes include FTS GIN, idempotency partial unique, org/status/created", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const indexes = await listIndexes(client, "reports");
      const indexNames = indexes.map((row) => String(row.indexname));
      const indexDefs = indexes.map((row) => String(row.indexdef)).join("\n");

      expect(indexNames).toContain("reports_search_vector_idx");
      expect(indexNames).toContain("reports_project_idempotency_uidx");
      expect(indexNames).toContain("reports_org_status_created_idx");
      expect(indexDefs).toMatch(GIN_INDEX_PATTERN);
      expect(indexDefs).toMatch(IDEMPOTENCY_PARTIAL_PATTERN);
    } finally {
      await client.end();
    }
  });

  test("insert report row succeeds with organization FK and synthetic project_id", async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const { createDbClient } = await import("../index");

    try {
      const db = createDbClient(databaseUrl);
      const orgId = `org_${crypto.randomUUID()}`;

      await db.execute(sql`
        insert into organization (id, name, slug, created_at)
        values (${orgId}, 'Test Org', ${`slug-${orgId}`}, now())
      `);

      await db.insert(reports).values({
        id: `rpt_${crypto.randomUUID()}`,
        idempotencyKey: `idem-${crypto.randomUUID()}`,
        organizationId: orgId,
        projectId: "prj_synthetic_no_fk",
        title: "Test report",
      });

      const rows = await db.execute(sql`
        select count(*)::int as count
        from reports
        where organization_id = ${orgId}
      `);

      expect(Number(rows[0]?.count)).toBe(1);
    } finally {
      await client.end();
    }
  });
});
