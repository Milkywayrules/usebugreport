import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  billingTierSchema,
  getTierLimits,
  isSellableTier,
  TIER_LIMITS,
} from "@usebugreport/config";
import { sql } from "drizzle-orm";
import { MockBillingProvider, NotPurchasableTierError } from "./index";

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("MockBillingProvider", () => {
  let db: import("@usebugreport/db").DbClient;
  let provider: MockBillingProvider;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;

  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    const dbModule = await import("@usebugreport/db");
    db = dbModule.createDbClient(databaseUrl);
    organizationTable = dbModule.schema.organization;
    provider = new MockBillingProvider(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table
        member,
        organization
      restart identity cascade
    `);
  });

  afterAll(async () => {
    await db.execute(sql`select 1`);
  });

  async function seedOrganization(tier: "free" | "pro" | "studio" | "agency") {
    await db.insert(organizationTable).values({
      billingTier: tier,
      createdAt: new Date(),
      id: "org_billing_test",
      name: "Billing Test Org",
      slug: "billing-test-org",
    });
  }

  test("getSellableTiers derives from isSellableTier over config tiers", () => {
    const sellable = provider.getSellableTiers();
    const expected = billingTierSchema.options.filter((tier) =>
      isSellableTier(tier)
    );

    expect(sellable).toEqual(expected);
    expect(sellable).toEqual(["free", "pro"]);
  });

  test("config import smoke — tier limits are not duplicated in billing", () => {
    expect(TIER_LIMITS.free.maxReportsPerMonth).toBe(30);
    expect(getTierLimits("pro").sellable).toBe(true);
    expect(getTierLimits("studio").sellable).toBe(false);
  });

  test("purchaseTier updates organization billing_tier for pro", async () => {
    await seedOrganization("free");

    const result = await provider.purchaseTier({
      organizationId: "org_billing_test",
      targetTier: "pro",
      userId: "user_test",
    });

    expect(result).toEqual({
      ok: true,
      organizationId: "org_billing_test",
      tier: "pro",
    });

    const tier = await provider.getWorkspaceTier("org_billing_test");
    expect(tier).toBe("pro");
  });

  test("purchaseTier throws NOT_PURCHASABLE for studio without updating tier", async () => {
    await seedOrganization("free");

    await expect(
      provider.purchaseTier({
        organizationId: "org_billing_test",
        targetTier: "studio",
        userId: "user_test",
      })
    ).rejects.toMatchObject({
      code: "NOT_PURCHASABLE",
      name: "NotPurchasableTierError",
    });

    const tier = await provider.getWorkspaceTier("org_billing_test");
    expect(tier).toBe("free");
  });

  test("purchaseTier throws NOT_PURCHASABLE for agency", async () => {
    await seedOrganization("pro");

    await expect(
      provider.purchaseTier({
        organizationId: "org_billing_test",
        targetTier: "agency",
        userId: "user_test",
      })
    ).rejects.toBeInstanceOf(NotPurchasableTierError);
  });
});

function createMockDb(initialTier: "free" | "pro" | "studio" | "agency") {
  const state = {
    billingTier: initialTier,
    id: "org_billing_unit",
  };

  const db = {
    query: {
      organization: {
        findFirst: () =>
          Promise.resolve({
            billingTier: state.billingTier,
          }),
      },
    },
    update: () => ({
      set: (values: { billingTier: typeof state.billingTier }) => ({
        where: () => ({
          returning: () => {
            state.billingTier = values.billingTier;
            return Promise.resolve([
              { billingTier: state.billingTier, id: state.id },
            ]);
          },
        }),
      }),
    }),
  };

  return {
    db: db as unknown as import("@usebugreport/db").DbClient,
    getTier: () => state.billingTier,
  };
}

describe("MockBillingProvider unit", () => {
  test("getSellableTiers returns exactly free and pro from config", () => {
    const { db } = createMockDb("free");
    const provider = new MockBillingProvider(db);

    expect(provider.getSellableTiers()).toEqual(["free", "pro"]);
  });

  test("getSellableTiers derives from isSellableTier over config tiers", () => {
    const { db } = createMockDb("free");
    const provider = new MockBillingProvider(db);
    const expected = billingTierSchema.options.filter((tier) =>
      isSellableTier(tier)
    );

    expect(provider.getSellableTiers()).toEqual(expected);
  });

  test("config import smoke — tier limits are not duplicated in billing", () => {
    expect(TIER_LIMITS.free.maxReportsPerMonth).toBe(30);
    expect(getTierLimits("pro").sellable).toBe(true);
    expect(getTierLimits("studio").sellable).toBe(false);
  });

  test("purchaseTier updates organization billing_tier for pro", async () => {
    const { db, getTier } = createMockDb("free");
    const provider = new MockBillingProvider(db);

    const result = await provider.purchaseTier({
      organizationId: "org_billing_unit",
      targetTier: "pro",
      userId: "user_test",
    });

    expect(result).toEqual({
      ok: true,
      organizationId: "org_billing_unit",
      tier: "pro",
    });
    expect(getTier()).toBe("pro");
  });

  test("purchaseTier updates organization billing_tier for free", async () => {
    const { db, getTier } = createMockDb("pro");
    const provider = new MockBillingProvider(db);

    const result = await provider.purchaseTier({
      organizationId: "org_billing_unit",
      targetTier: "free",
      userId: "user_test",
    });

    expect(result.tier).toBe("free");
    expect(getTier()).toBe("free");
  });

  test("purchaseTier throws NOT_PURCHASABLE for studio without updating tier", async () => {
    const { db, getTier } = createMockDb("free");
    const provider = new MockBillingProvider(db);

    await expect(
      provider.purchaseTier({
        organizationId: "org_billing_unit",
        targetTier: "studio",
        userId: "user_test",
      })
    ).rejects.toMatchObject({
      code: "NOT_PURCHASABLE",
      name: "NotPurchasableTierError",
    });
    expect(getTier()).toBe("free");
  });

  test("purchaseTier throws NOT_PURCHASABLE for agency", async () => {
    const { db } = createMockDb("pro");
    const provider = new MockBillingProvider(db);

    await expect(
      provider.purchaseTier({
        organizationId: "org_billing_unit",
        targetTier: "agency",
        userId: "user_test",
      })
    ).rejects.toBeInstanceOf(NotPurchasableTierError);
  });
});
