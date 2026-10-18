/**
 * @myco-demo/shared-utils — Public API (refactored)
 *
 * BREAKING CHANGES in this version:
 * - formatUser renamed to formatUserDisplay
 * - generateOrderId removed (use uuid library directly)
 */

export { formatUserDisplay, UserRecord } from "./userFormatter";
export { calculateTax, TaxResult } from "./taxCalculator";
export { formatOrderSummary } from "./orderUtils";
