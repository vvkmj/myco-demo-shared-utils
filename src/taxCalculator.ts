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
export function calculateTax(subtotal: number, taxRatePercent: number, currency: string): TaxResult {
  const taxAmount = parseFloat(((subtotal * taxRatePercent) / 100).toFixed(2));
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    taxRate: taxRatePercent,
  };
}
