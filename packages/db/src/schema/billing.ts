import { pgEnum } from "drizzle-orm/pg-core";

export const billingTierEnum = pgEnum("billing_tier", [
  "free",
  "pro",
  "studio",
  "agency",
]);

export type BillingTier = (typeof billingTierEnum.enumValues)[number];
