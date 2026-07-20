import type { BillingTier } from "@usebugreport/config";

export interface PurchaseTierInput {
  organizationId: string;
  targetTier: BillingTier;
  userId: string;
}

export interface PurchaseTierResult {
  ok: true;
  organizationId: string;
  tier: BillingTier;
}

export interface BillingProvider {
  getSellableTiers: () => BillingTier[];
  getWorkspaceTier: (organizationId: string) => Promise<BillingTier>;
  purchaseTier: (input: PurchaseTierInput) => Promise<PurchaseTierResult>;
}
