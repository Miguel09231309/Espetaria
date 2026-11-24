# Security Specification — Brasa de Domingo

## 1. Data Invariants
1. **Owner Isolation**: Every document across `storeSettings`, `customHolidays`, `insumos`, `products`, `customers`, `orders`, `fiadoTransactions`, `dailyExpenses`, and `whatsappLogs` must carry `ownerId == request.auth.uid`. No user can read, list, create, update, or delete another owner's records.
2. **Verified Email Identity**: Every read/write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Time**: `ownerId` and `createdAt` cannot be modified after creation. `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on updates where applicable.
4. **Strict Field Allowlisting (No Shadow Fields)**: Every `create` enforces `keys().hasAll(...) && keys().hasOnly(...)` and every `update` enforces `affectedKeys().hasOnly(...)` per named action.
5. **Bounded Sizes & Valid Enums**: All strings enforce `.size() <= MAX`, all numeric totals/prices are `>= 0`, all IDs match `^[a-zA-Z0-9_\-]+$`, and `orders.items` is bounded to `1 <= size() <= 25`.
6. **Terminal Order Locking**: Orders with `orderStatus == 'cancelado'` cannot be mutated back to active states.
7. **PII Isolation**: Customer WhatsApp numbers and neighborhoods (`customers`, `orders`, `whatsappLogs`) are strictly readable/listable only when `resource.data.ownerId == request.auth.uid`.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Product Create**: `{ ..., isAdminOverride: true }` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Order Create**: `{ ownerId: "other_uid", ... }` -> `PERMISSION_DENIED`.
3. **Unverified Email Token Write**: `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
4. **ID Poisoning (Oversized Document ID)**: `/products/${'a'.repeat(200)}` -> `PERMISSION_DENIED`.
5. **Timestamp Forgery on Create**: `{ ..., createdAt: pastTimestamp }` (not `request.time`) -> `PERMISSION_DENIED`.
6. **Immutable `ownerId` Mutation on Update**: Updating a customer with `{ ownerId: "attacker_uid" }` -> `PERMISSION_DENIED`.
7. **Blanket List Scraping**: Listing `/customers` without filtering to `ownerId == request.auth.uid` -> `PERMISSION_DENIED`.
8. **Negative Price / Financial Tampering**: Creating a product with `{ price: -10 }` -> `PERMISSION_DENIED`.
9. **Unbounded Array Exhaustion**: Creating an order with `items.length === 40` -> `PERMISSION_DENIED`.
10. **Terminal State Resurrection**: Updating an order from `orderStatus: 'cancelado'` to `'entregue'` -> `PERMISSION_DENIED`.
11. **Oversized String Poisoning (Denial of Wallet)**: Creating `customerNotice` with 1,000 chars (exceeds 280) -> `PERMISSION_DENIED`.
12. **PII Cross-Tenant Read**: User B calling `get` on User A's `/customers/{id}` -> `PERMISSION_DENIED`.
