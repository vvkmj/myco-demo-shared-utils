/**
 * Order utilities.
 * NOTE: generateOrderId has been removed in this refactor.
 * myco-demo-api-service still imports generateOrderId — this will break its build.
 */

export function formatOrderSummary(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}
