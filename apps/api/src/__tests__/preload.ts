import { applyTestEnv, testDatabaseUrl } from "./test-env";

applyTestEnv();
process.env.DATABASE_URL ??= testDatabaseUrl;
