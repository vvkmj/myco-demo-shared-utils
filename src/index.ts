/**
 * @myco-demo/shared-utils — Public API
 *
 * All exports in this file are consumed by myco-demo-api-service.
 * Renaming or removing them is a BREAKING CHANGE across repos.
 */

export { formatUser, UserRecord } from "./userFormatter";
export { calculateTax, TaxResult } from "./taxCalculator";
export { generateOrderId } from "./orderUtils";
