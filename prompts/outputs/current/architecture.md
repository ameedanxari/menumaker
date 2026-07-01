# MenuMaker Target Architecture

_Decision status: proposed for execution; source-backed by `source-ledger.md`._

## Architecture style

MenuMaker remains one deployable Fastify **modular monolith** for the remediation horizon. Web, Business/Customer Android, Business/Customer iOS, and admin/support experiences are portals/UI surfaces only; they are not systems of record or write-owner boundaries. PostgreSQL is the canonical source of truth. AWS ECS Fargate is the proposed runtime with RDS PostgreSQL, S3/CloudFront, ALB, Route 53/ACM, Secrets Manager/KMS, ECR, CloudWatch/X-Ray, and private networking (`SRC-006`, `SRC-008`).

## Bounded contexts and state ownership

| Context | Canonical write ownership | Commands | Queries/projections |
|---|---|---|---|
| Identity & Access | users, refresh sessions, admin users/roles | sign up, rotate/revoke session, suspend/ban, change role | account/profile/session/admin views |
| Business Catalog | businesses, settings, dishes, categories, menus/items | configure business, mutate/publish menu | public/seller menu projections |
| Ordering | orders, order items, saved carts | create/cancel/transition order | seller/customer order timelines |
| Payments & Billing | payments, subscriptions, payouts, processor config | create intent, apply signed event, refund, subscribe | payment/subscription/payout views |
| Promotions | coupons/usages, referrals/rewards/affiliate state | apply coupon, qualify/post reward | offer/referral statistics |
| Marketplace & Reviews | marketplace settings/favorites, reviews/responses | favorite, submit/respond/moderate review | discovery/rating projections |
| Fulfilment Integrations | delivery/POS integrations, sync logs/tracking | connect, sync, dispatch/update delivery | provider status/tracking views |
| Notifications | notification/outbox/device state | enqueue, dispatch, retry/replay | user/support delivery status |
| Compliance & Administration | consent, deletion requests, support/content flags, audit log | export/delete, support/moderation/admin action | evidence/support/admin views |
| Reporting | append-only projections/checkpoints only | rebuild projection | seller/platform analytics; never canonical writes |

Each canonical state has exactly one write owner. Shared physical PostgreSQL is acceptable only with module/schema ownership, app-layer tenant/role/purpose checks, no cross-context mutable repository access, and contract tests. Cross-context work uses owned commands, queries, versioned events, or projections; portals never bypass an owner.

## Tier 0 workflows and commit boundaries

| Workflow | Atomic commit boundary | Fail closed when | Ordering/idempotency | Recovery evidence |
|---|---|---|---|---|
| Order placement | order + items + calculated totals + idempotency receipt + outbox intent | menu/version/price/tenant/payment method cannot be verified | customer/cart command key; order ID | row/checksum comparison after restore |
| Payment event | signed event receipt + payment transition + order entitlement + outbox | raw signature, amount/currency/order ownership, transition, or DB commit uncertain | Stripe event ID and payment/order key | event receipt, transition audit, replay report |
| Subscription entitlement | signed event receipt + subscription state + tier entitlement | signature/customer/business/current object uncertain | event ID; retrieve current object for stale order | receipt and entitlement reconciliation |
| Referral/reward | qualification + immutable credit ledger + coupon/outbox | eligibility or duplicate qualification uncertain | referral qualification key | ledger/coupon/notification correlation |
| Privacy deletion | job step receipts + anonymization/deletion manifest | inventory, legal hold, tenant boundary, or required processor step uncertain | request ID + location step key | signed manifest and retained rationale |
| Admin/moderation | action + target mutation + audit intent | role/MFA/purpose/reason/audit commit uncertain | action ID | append-only audit verification |

The initial target does **not** promise universal zero data loss. Target RPO/RTO must be approved per workflow: Tier 0 database RPO approaches the last durable RDS Multi-AZ commit with point-in-time recovery and tested backups; catastrophic region loss remains bounded by the last replicated/retained backup until cross-region recovery is approved. Restore drills, not configuration intent, prove actual RPO/RTO.

## Eventing, outbox, and projections

- PostgreSQL state is the durable authority; a queue/event bus is transport, never the source of truth.
- Domain state, audit intent, and transactional outbox row commit together.
- Event envelope includes event ID, schema version, owner, correlation/causation, tenant, ordering key, occurred/recorded time, and redacted metadata.
- Consumers use inbox/idempotency receipts, bounded retries with jitter, dead-letter queue (DLQ), poison-message classification, owner/SLA, and audited replay.
- Ordered workflows use business/order/payment keys; unrelated aggregates may process concurrently.
- Reporting reads append-only projections with checkpoints and rebuild support; it cannot write canonical domain tables.

## API and client architecture

Fastify route schemas generate `openapi/menumaker.v1.yaml`, the authoritative contract (`SRC-009`). Generated TypeScript/Kotlin/Swift transport DTOs stay behind adapters; domain/persistence/UI models remain platform-owned. Wire conventions are `/api/v1`, snake_case JSON, UTC ISO-8601 strings, integer minor currency units, canonical status enums, stable error/pagination envelopes, and idempotency keys for mutations. Contract drift and breaking changes fail CI.

## Security and privacy

- Browser refresh/session credentials use HttpOnly, Secure, SameSite cookies or approved BFF flow; no browser storage JWTs (`SRC-003`, `SRC-004`).
- Android uses Keystore-backed protected credentials; iOS retains Keychain (`SRC-003`, `SRC-005`).
- Stripe card data stays within Stripe SDK/tokenization. Exact raw payload bytes, `Stripe-Signature`, endpoint secret, event deduplication, and monotonic transitions guard webhooks (`SRC-001`, `SRC-002`).
- Provider credentials use Secrets Manager/KMS envelope encryption with tenant-bound authenticated context; databases/logs/backups never hold plaintext provider secrets.
- Identity, tenant, role, purpose, consent, and risk checks execute at the owning context. Admin actions require role/MFA and append-only audit intent.
- A field-level data inventory controls collection, logs/traces, retention, export/deletion, backups, processors, mobile caches, and store declarations.

## Immutable audit and evidence

Sensitive admin/payment/privacy/replay/restore actions create append-only audit records with actor, reason, target, before/after hashes, correlation, and time. Periodic verification jobs hash/sequence audit batches and anchor manifests in an S3 Object Lock/WORM retention bucket with KMS encryption. Evidence export includes checksums and chain of custody. High-risk actions fail closed when required audit intent cannot commit; analytics stores may query copies but are not the legal/audit anchor.

## AWS deployment topology

- ALB terminates TLS using ACM and routes only to private ECS Fargate tasks.
- RDS PostgreSQL is private, encrypted, Multi-AZ in production, deletion-protected, backed up with PITR and scheduled restore drills.
- S3 media is private with signed access; web assets use a separate origin behind CloudFront; no public writable bucket.
- Secrets Manager/KMS holds runtime/provider credentials; task roles are least privilege.
- ECR image digests and checksummed web/mobile artifacts are immutable release identities.
- CloudWatch logs/metrics/alarms and X-Ray/OpenTelemetry traces carry bounded labels and redaction; SNS routes alerts.
- Dev, staging, and production use the same Terraform environment module with separate state/accounts or strictly isolated roles/inputs. Production deployment requires plan review, environment approval, migration job, artifact promotion, synthetic verification, and application rollback.

## Data residency and disaster recovery

Launch region is proposed `us-east-1` only because current Terraform declares it; market/legal approval may require a different region. This is an open ADR, not a residency guarantee. Data/backup/log/evidence placement and processors must match approved markets. RDS backups/PITR, object versioning/retention, Terraform state recovery, artifact retention, and runbooks are exercised quarterly. Regional outage recovery has an explicit caveat: initial single-region service cannot guarantee RPO 0 or immediate RTO; cross-region replication/failover requires cost, consistency, residency, and operations approval.

## Observability and operations

OpenTelemetry correlates Fastify/PostgreSQL/provider/outbox spans; Pino logs redact secrets/PII. RED metrics plus order/payment correctness, outbox/DLQ lag, migration/backup/restore, and mobile sync signals implement the SLO catalog. Liveness is process-only; readiness includes database/migrations/required capabilities. Multi-window SLO burn and Tier 0 correctness route alerts to owned runbooks. Fabricated uptime/error data is prohibited.

## Client and UI architecture

Each client follows generated transport DTO → mapper → domain model → repository/cache → use case/ViewModel/store → explicit UI state. Existing MenuMaker theme is authoritative. A canonical token JSON generates web CSS/Tailwind, Android Material, and iOS theme outputs. UI state contracts cover default, loading, empty, error, disabled, success, and offline/pending where relevant, with accessibility/RTL/light/dark verification.

## Architecture evolution gates

Do not split services until module dependency checks, owned transactions, outbox/inbox semantics, telemetry, deployment independence, and measured scaling justify it. A service extraction ADR must name state transfer, API/event compatibility, dual-write avoidance, migration/rollback, SLO ownership, and additional operational cost.

## Source-backed decisions

- `SRC-008`, `RD-004`: migrations and contract authority are foundational.
- `SRC-001`–`SRC-005`, `RD-001`–`RD-002`: payment/session boundaries fail closed.
- `SRC-006`–`SRC-007`, `RD-003`: CI/IaC promotion is immutable, least privilege, and fail closed.
- `SRC-009`, `RD-004`: all platform clients derive from one API contract.
- `SRC-010`, `RD-005`: docs/history use governed authority and archival provenance.
