/**
 * Generates a unique order ID with a timestamp prefix.
 * Consumed by myco-demo-api-service in src/routes/orders.ts
 *
 * Signature: generateOrderId(): string
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}
