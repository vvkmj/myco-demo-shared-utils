# @myco-demo/shared-utils

> **Demo repo** — Part of the Myco cross-repo breakage detection test.

This package is the **upstream library**. It exports shared types and utilities consumed by [`myco-demo-api-service`](https://github.com/vvkmj/myco-demo-api-service).

## Exports

| Export | File | Consumers |
|--------|------|-----------|
| `formatUser(user: UserRecord): string` | `src/userFormatter.ts` | `api-service/src/routes/users.ts` |
| `UserRecord` (interface) | `src/userFormatter.ts` | `api-service/src/routes/users.ts` |
| `calculateTax(subtotal, rate): TaxResult` | `src/taxCalculator.ts` | `api-service/src/services/checkout.ts` |
| `TaxResult` (interface) | `src/taxCalculator.ts` | `api-service/src/services/checkout.ts` |
| `generateOrderId(): string` | `src/orderUtils.ts` | `api-service/src/routes/orders.ts` |

## Myco Integration

Myco runs on every PR via `.github/workflows/myco.yml`.  
It performs **bidirectional cross-repo verification**:
- Checks that this repo's exports still satisfy what `myco-demo-api-service` imports.
- Flags any removed/renamed export as `P1-XREPO-BREAKING` and blocks the merge.
