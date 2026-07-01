# ADR 0003: API contract authority and generated clients

## Status

Accepted for the MenuMaker remediation baseline.

## Context

MenuMaker currently has four competing API contracts: Fastify route code,
the web API client, Android Retrofit annotations, and iOS endpoint constants.
The audit found method, path, query, response-wrapper, status-enum, analytics,
payment, integration, and date-format drift across those clients. Drift is now
treated as a release blocker because a platform can appear locally healthy
while shipping against a server route that does not exist.

## Decision

OpenAPI 3.1 is the single API authority for `/api/v1`. The canonical tracked
document is `openapi/menumaker.v1.yaml`; it is generated from schema-complete
Fastify route registrations exposed by `buildApp()` and then consumed by web,
Android, and iOS generated-client tooling.

The server owns compatibility at the boundary. Clients must not preserve hidden
aliases for divergent legacy routes. When compatibility is needed, the server
adds a documented adapter, emits a deprecation signal, and keeps that adapter
for a published deprecation window.

## Wire-format rules

- All version-one routes live under `/api/v1`.
- Wire fields use `snake_case`, including query parameters and response fields.
- Dates and timestamps are ISO-8601 UTC strings with a `Z` offset.
- Money is always integer minor units, for example `amount_minor` in cents.
- Identifiers are strings at the API boundary unless a third-party provider
  requires a documented alternative.
- Mutating payment/order operations accept `Idempotency-Key`.
- Pagination uses `limit`, `cursor`, `next_cursor`, and `has_more`.
- Success responses use `{ "data": ... }`; list responses use
  `{ "data": [...], "pagination": ... }`.
- Errors use `{ "error": { "code", "message", "request_id", "details" } }`.

## Canonical statuses

Orders use: `draft`, `pending`, `accepted`, `preparing`, `ready`,
`out_for_delivery`, `completed`, `cancelled`, `refunded`.

Payments use: `requires_payment_method`, `requires_confirmation`,
`processing`, `succeeded`, `failed`, `cancelled`, `refunded`.

Subscriptions use: `trialing`, `active`, `past_due`, `cancelled`, `unpaid`.

Reviews use: `pending`, `published`, `hidden`, `reported`, `removed`.

## Compatibility policy

Breaking changes require one of:

1. a new major API prefix such as `/api/v2`; or
2. a documented compatibility adapter in the server boundary with owner,
   sunset date, telemetry, and migration notes.

Breaking changes include removing or renaming operations, changing required
fields, narrowing enum values, changing response envelopes, changing query
names, or moving a client-visible status without an adapter.

Generated code must not hide breaking changes. Generated files are owned by the
contract tooling, not by hand-written domain code.

## Client ownership

- `backend/src/app.ts` owns schema-complete route registration and exposes
  `buildApp()` for contract/integration tests without opening a port.
- `openapi/menumaker.v1.yaml` is the reviewed canonical contract artifact.
- `shared/src/generated/api.ts` is generated TypeScript and must not be edited
  by hand.
- Android generated transport code is produced under
  `android/app/build/generated/openapi` before compilation.
- iOS generated transport code is produced under
  `ios/MenuMaker/Generated/API`.

Domain models remain hand-written. Generated DTOs are transport boundary types,
not persistence entities, Room entities, SwiftUI view models, or frontend state
stores.

## Enforcement

CI must run the contract verifier before platform builds:

```bash
bash scripts/contracts/verify-all.sh
```

The verifier must fail non-zero with the owning file and actionable diagnostics
when:

- a `/api/v1` operation is undocumented;
- generated output is stale;
- the OpenAPI document is invalid;
- a removed or renamed operation is detected without a major-version change;
- web, Android, or iOS generated-client wiring drifts from
  `openapi/menumaker.v1.yaml`.

## Consequences

The remediation accepts a short-lived red baseline while platform clients move
behind generated adapters. Once this ADR is implemented, future route work must
start with schema and compatibility decisions instead of copying endpoint
strings into each client.
