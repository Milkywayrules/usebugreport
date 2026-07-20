import {
  type BillingTier,
  billingTierSchema,
  isSellableTier,
} from "@usebugreport/config";
import type { DbClient } from "@usebugreport/db";
import { organization } from "@usebugreport/db";
import { eq } from "drizzle-orm";
import { NotPurchasableTierError } from "./errors";
import type {
  BillingProvider,
  PurchaseTierInput,
  PurchaseTierResult,
} from "./provider";

export class MockBillingProvider implements BillingProvider {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async getWorkspaceTier(organizationId: string): Promise<BillingTier> {
    const row = await this.db.query.organization.findFirst({
      columns: { billingTier: true },
      where: eq(organization.id, organizationId),
    });

    if (!row) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    return billingTierSchema.parse(row.billingTier);
  }

  getSellableTiers(): BillingTier[] {
    return billingTierSchema.options.filter((tier) => isSellableTier(tier));
  }

  async purchaseTier(input: PurchaseTierInput): Promise<PurchaseTierResult> {
    const targetTier = billingTierSchema.parse(input.targetTier);

    if (!isSellableTier(targetTier)) {
      throw new NotPurchasableTierError(targetTier);
    }

    const updated = await this.db
      .update(organization)
      .set({ billingTier: targetTier })
      .where(eq(organization.id, input.organizationId))
      .returning({
        billingTier: organization.billingTier,
        id: organization.id,
      });

    if (updated.length === 0) {
      throw new Error(`Organization not found: ${input.organizationId}`);
    }

    return {
      ok: true,
      organizationId: updated[0]?.id ?? input.organizationId,
      tier: billingTierSchema.parse(updated[0]?.billingTier),
    };
  }
}
