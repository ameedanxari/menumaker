# Remediation Prompt — Bounded-Context and Code-Ownership Consolidation

_Closes gap:_ G9 · bounded-context-and-code-ownership-consolidation

## Context

MenuMaker grew by feature phase: one backend bootstrap registers dozens of domains, portals duplicate contract/state models, compatibility aliases hide drift, and production/test concerns coexist in large files. Seller/customer/admin are experiences, not data owners. Consolidation must establish one write owner for canonical state without forcing an unsafe big-bang microservice rewrite.

## What to build

Define a modular-monolith target architecture with explicit bounded contexts, dependency direction, state ownership, commands/queries/events, and portal composition; introduce enforceable package boundaries and vertical slices incrementally; extract shared infrastructure and test seams; and retire compatibility aliases only after contract and migration evidence.

Client UI layering must preserve the existing theme authority and state contracts for default, loading, empty, error, disabled, and success while moving ownership; consolidation is not permission to redesign screens.

## Implementation guidance

## R1 · Publish the target-state architecture and ownership map
- **Closes user story:** As an architect, I need every canonical state to have one write owner, so that portals and integrations cannot create contradictory records.
- **Change type:** create-new
- **File:** `docs/architecture/target-state.md`
- **File:** `scripts/architecture/verify_state_ownership.py`
- **Precise change:** Define Identity, Business Catalog, Ordering, Payments/Billing, Promotions/Referrals, Marketplace/Reviews, Fulfilment/Integrations, Notifications, Compliance/Admin, and Reporting contexts; map owned tables, commands, queries, events, projections, forbidden writers, transaction boundaries, and seller/customer/admin consumers; keep one deployable Fastify modular monolith initially.
- **Acceptance:** 
  - Every TypeORM entity/table is assigned exactly one write owner and zero or more read projections.
  - Orders/payments/subscriptions/rewards/audit workflows name atomic boundaries, idempotency keys, ordering keys, replay owner, and fail-closed behavior.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-authoritative-api-contract-and-client-generation.md (API authority)
- **Test:** `python3 scripts/architecture/verify_state_ownership.py docs/architecture/target-state.md backend/src/models` reports complete unique ownership.
- **Estimated LOC:** +320
- **Phase:** foundation

## R2 · Add architecture decision and dependency enforcement
- **Closes user story:** As a maintainer, I need machine-enforced module boundaries, so that new code cannot restore cross-domain coupling after consolidation.
- **Change type:** create-new
- **File:** `scripts/architecture/check-boundaries.ts`
- **File:** `scripts/architecture/fixtures/valid/domain/order-policy.ts`
- **File:** `scripts/architecture/fixtures/valid/application/order-command.ts`
- **File:** `scripts/architecture/fixtures/invalid-cross-owner/application/payment-route.ts`
- **File:** `scripts/architecture/fixtures/invalid-cycle/domain/order-cycle.ts`
- **Precise change:** Parse TypeScript imports and enforce `domain -> application -> infrastructure/http` direction per context, prohibit route-to-repository private access and cross-context entity mutations, allow shared kernel only for IDs/money/time/error primitives, and compare exceptions to dated ADR entries.
- **Acceptance:** 
  - Existing violations are emitted as a finite baseline with owner and expiry; new violations fail CI.
  - The checker catches payment routes reaching a private repository and non-owner contexts importing mutable entities.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (context/dependency map)
- **Test:** `node --import tsx scripts/architecture/check-boundaries.ts --fixtures scripts/architecture/fixtures` accepts valid and rejects cyclic/cross-owner fixtures.
- **Estimated LOC:** +280
- **Phase:** foundation

## R3 · Extract Fastify composition from domain modules
- **Closes user story:** As a backend developer, I need isolated context modules, so that I can test and change one capability without loading every provider and route.
- **Change type:** create-new
- **File:** `backend/src/contexts/index.ts`
- **File:** `backend/tests/context-modules.test.ts`
- **Precise change:** Define a `ContextModule` contract exposing routes, services, repositories, event handlers, readiness, and capability metadata; migrate registrations from `main.ts`/`app.ts` in ownership order; inject infrastructure adapters; and prevent context modules from importing the global Fastify singleton.
- **Acceptance:** 
  - `main.ts` contains only process lifecycle and `buildApp` composition; route modules are registered through context manifests.
  - Each context can construct with in-memory/test adapters and exposes no mutable repository owned by another context.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (enforced boundaries)
- **Test:** `npm test --workspace=backend -- context-modules.test.ts --runInBand` constructs every context independently and verifies forbidden imports.
- **Estimated LOC:** +260
- **Phase:** foundation

## R4 · Introduce explicit command, query, event, and projection contracts
- **Closes user story:** As an integration developer, I need owned cross-context contracts, so that side effects are replayable and analytics cannot mutate source tables.
- **Change type:** create-new
- **File:** `backend/src/kernel/contracts.ts`
- **File:** `backend/tests/contracts.test.ts`
- **File:** `backend/tests/context-integration.test.ts`
- **Precise change:** Define branded IDs, Money, UTC timestamp, command metadata, idempotency key, actor/tenant/purpose context, domain event envelope with schema version/ordering key, query pagination, and projection checkpoint; apply first to order→payment→notification and referral→reward workflows.
- **Acceptance:** 
  - Cross-context calls use commands/queries/events rather than importing services/entities across owners.
  - Events carry owner, version, correlation/causation, ordering, retention, and replay metadata and have schema compatibility tests.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (context modules)
- **Test:** `npm test --workspace=backend -- contracts.test.ts context-integration.test.ts --runInBand` exits 0.
- **Estimated LOC:** +300
- **Phase:** foundation

## R5 · Consolidate client domain/repository ownership
- **Closes user story:** As a cross-platform developer, I need transport, domain, persistence, and UI state separated consistently, so that generated DTOs and cached entities cannot leak into screens.
- **Change type:** create-new
- **File:** `docs/architecture/client-layering.md`
- **File:** `scripts/architecture/verify_client_layers.py`
- **Precise change:** Define generated transport DTO→domain mapper→repository→use-case/ViewModel→UI-state layers for web, Android, and iOS; assign auth/session, cart, order, and settings cache ownership; prohibit UI imports of generated DTOs/endpoint strings and repository imports of platform screens.
- **Acceptance:** 
  - Representative auth, seller menu/order, customer cart/checkout, and settings flows map to concrete existing/new files on each platform.
  - Architecture checks identify duplicate repository/state owners and direct transport access from UI.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-authoritative-api-contract-and-client-generation.md (generated contract enforcement), R1 (state ownership principles)
- **Test:** `python3 scripts/architecture/verify_client_layers.py frontend/src android/app/src/main/kotlin ios/MenuMaker` reports zero unapproved layer reversals.
- **Estimated LOC:** +180
- **Phase:** foundation

## R6 · Remove compatibility aliases after consumer migration
- **Closes user story:** As a maintainer, I need legacy aliases retired with evidence, so that one domain vocabulary remains after consolidation.
- **Change type:** create-new
- **File:** `docs/architecture/deprecation-ledger.yaml`
- **File:** `scripts/architecture/verify_deprecations.py`
- **Precise change:** List route aliases, `Order.status`/`total_amount_cents`, legacy endpoint paths, duplicate DTOs, old context imports, owner, replacement, consumers, telemetry, removal release, and rollback; delete only after contract/client scans and one deprecation window prove zero use.
- **Acceptance:** 
  - Every compatibility alias in production source has a ledger row or is removed.
  - Removal PRs include consumer search, contract diff, migration impact, and rollback evidence.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (canonical context vocabulary), R5 (client layering)
- **Test:** `python3 scripts/architecture/verify_deprecations.py docs/architecture/deprecation-ledger.yaml` reports no orphan alias or expired entry.
- **Estimated LOC:** +140
- **Phase:** foundation

## What NOT to do

- Do not split into network microservices before module ownership, transactions, and observability are proven.
- Do not treat web/mobile/admin portals as canonical data owners.
- Do not create a generic shared module containing domain services or mutable models from every context.
