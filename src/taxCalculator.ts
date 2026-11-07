/**
 * Result of a tax calculation.
 * Consumed by myco-demo-api-service in src/services/checkout.ts
 */
export interface TaxResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
}

/**
 * Calculates tax for a given subtotal and tax rate percentage.
 * Signature: calculateTax(subtotal: number, taxRatePercent: number): TaxResult
 *
 * myco-demo-api-service calls this as: calculateTax(order.subtotal, 8.5)
 */
export function calculateTax(subtotal: number, taxRatePercent: number): TaxResult {
  const taxAmount = parseFloat(((subtotal * taxRatePercent) / 100).toFixed(2));
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    taxRate: taxRatePercent,
  };
}

/**
 * Calculates shipping tax based on base shipping cost and rate.
 * Signature: calculateShippingTax(shippingCost: number, taxRatePercent?: number): number
 */
export function calculateShippingTax(shippingCost: number, taxRatePercent = 0): number {
  if (shippingCost < 0) {
    throw new Error("Shipping cost cannot be negative");
  }
  return parseFloat(((shippingCost * taxRatePercent) / 100).toFixed(2));
}
