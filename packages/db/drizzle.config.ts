import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://usebugreport:usebugreport@localhost:5432/usebugreport";

export default defineConfig({
  dbCredentials: { url: databaseUrl },
  dialect: "postgresql",
  out: "./migrations",
  schema: "./src/schema/index.ts",
});
