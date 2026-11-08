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

export function calculateDiscount(amount: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Invalid discount percentage");
  }
  return amount * (1 - discountPercent / 100);
}
