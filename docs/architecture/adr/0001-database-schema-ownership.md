# ADR 0001: Database Schema Ownership

## Status

Accepted.

## Context

PostgreSQL is MenuMaker's canonical state store for Tier 0 records such as
orders, payments, subscriptions, payouts, audit logs, deletion requests, and
tax evidence. Production deployment cannot rely on implicit ORM mutation
because silent schema changes are not reviewable, repeatable, or recoverable.

## Decision

`backend/src/migrations/` is the only production schema-authority path.
Production schema changes must be applied by a dedicated migration job that
calls `AppDataSource.runMigrations()` through the TypeORM migration runner.
Application startup may inspect pending migrations, but it must not create,
drop, or mutate production schema on its own.

TypeORM `synchronize` is prohibited outside local development. It is enabled
only when `DB_SYNCHRONIZE_LOCAL=true` and `NODE_ENV` is not `production`.
`NODE_ENV=production DB_SYNCHRONIZE_LOCAL=true` is a configuration error.

## Migration policy

- Use expand/contract migrations for compatibility-sensitive changes:
  add nullable/new structures first, dual-write or backfill, migrate readers,
  then contract in a later release.
- Prefer forward-fix migrations for deployed production defects. Rollback is
  allowed only when data preservation is proven or the environment is a
  disposable test database.
- Every migration must be deterministic, reviewed, and free of seed/customer
  data.
- Schema writes use TypeORM's migration table and PostgreSQL advisory-lock
  ownership from the migration job, not app request workers.
- Destructive migrations require restore evidence and explicit approval.

## Startup and release behavior

The application fails closed when pending migrations exist unless it is running
as the dedicated migration job (`DB_MIGRATION_JOB=true`). Readiness must report
pending migration names so operators can run the job before serving traffic.

CI must verify:

1. zero-to-current migration from an empty disposable PostgreSQL database;
2. upgrade from a previous release fixture;
3. rollback safety for failed migrations in test-only environments;
4. checksum-verified backup and restore evidence for Tier 0 tables.

## RPO/RTO assumptions

- Zonal failure: RPO targets the latest committed database transaction and RTO
  is bounded by automated failover plus application restart.
- Regional loss: no blanket zero-data-loss claim; RPO/RTO depend on replicated
  backup cadence and restore drill evidence.
- Operator error: restore point depends on the most recent verified backup and
  audit trail.
- Destructive migration: recovery depends on pre-migration backup verification
  and forward-fix feasibility.
- Logical corruption: restore may require point-in-time recovery plus manual
  reconciliation of order/payment/subscription records.

## Consequences

Development synchronization remains a temporary local-only escape hatch.
Production releases become slower but safer: schema changes are explicit,
reviewable, and tied to restore evidence before promotion.
