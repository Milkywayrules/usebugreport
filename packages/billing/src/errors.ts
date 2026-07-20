export class NotPurchasableTierError extends Error {
  readonly code = "NOT_PURCHASABLE" as const;
  readonly tier: string;

  constructor(tier: string) {
    super(`Tier "${tier}" is not available for self-service purchase.`);
    this.name = "NotPurchasableTierError";
    this.tier = tier;
  }
}
