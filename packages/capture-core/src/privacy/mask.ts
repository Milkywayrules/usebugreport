import type { recordOptions } from "rrweb";
import type { CaptureCoreConfig } from "../types";

/** Credit-card field patterns aligned with PRD maskInputs. */
const DEFAULT_CREDIT_CARD_SELECTORS = [
  '[autocomplete="cc-number"]',
  '[autocomplete="cc-exp"]',
  '[autocomplete="cc-exp-month"]',
  '[autocomplete="cc-exp-year"]',
  '[autocomplete="cc-csc"]',
  'input[name*="card" i]',
  'input[name*="credit" i]',
  'input[id*="card" i]',
  "input[data-card]",
];

export type PrivacyRecordOptions = Pick<
  recordOptions<unknown>,
  | "maskAllInputs"
  | "maskInputOptions"
  | "maskTextSelector"
  | "blockClass"
  | "ignoreClass"
>;

/**
 * Maps capture-core privacy config to rrweb record privacy options (FR-2).
 */
export function buildPrivacyOptions(
  config: Pick<CaptureCoreConfig, "maskSelectors" | "blockClass">
): PrivacyRecordOptions {
  const blockClass = config.blockClass ?? "ubr-block";
  const customSelectors = config.maskSelectors ?? [];
  const maskTextSelector = [
    ...DEFAULT_CREDIT_CARD_SELECTORS,
    ...customSelectors,
  ].join(", ");

  return {
    blockClass,
    ignoreClass: blockClass,
    maskAllInputs: true,
    maskInputOptions: {
      color: false,
      date: false,
      "datetime-local": false,
      email: false,
      month: false,
      number: false,
      password: true,
      range: false,
      search: false,
      select: false,
      tel: false,
      text: false,
      textarea: false,
      time: false,
      url: false,
      week: false,
    },
    maskTextSelector,
  };
}
