# Remediation Prompt — Database Schema and Release Integrity

_Closes gap:_ G1 · database-schema-and-release-integrity

## Context

MenuMaker disables TypeORM synchronization in production, but no migration files exist. The release path therefore has no deterministic way to create or upgrade the PostgreSQL schema. Orders, payments, subscriptions, payouts, audit records, and deletion requests are Tier 0 state: their mutations, schema changes, backups, and restores must be explicit, reviewable, and recoverable.

## What to build

Establish TypeORM migrations as the only production schema authority, generate and review a baseline migration covering every registered entity, add zero-to-current and upgrade-path verification, and make backup/restore evidence a prerequisite for production promotion. Development synchronization may remain temporarily available only behind an explicit local-only flag.

## Implementation guidance

## R1 · Record schema ownership and migration policy
- **Closes user story:** As a release engineer, I need one documented schema authority, so that application deployment cannot silently mutate production data structures.
- **Change type:** create-new
- **File:** `docs/architecture/adr/0001-database-schema-ownership.md`
- **Precise change:** Record PostgreSQL as canonical state, TypeORM migrations as the sole non-local schema writer, prohibited production use of `synchronize`, expand/contract rules, rollback-versus-forward-fix criteria, advisory-lock ownership, and Tier 0 RPO/RTO assumptions for order/payment/subscription state.
- **Acceptance:** 
  - The ADR names `backend/src/migrations/` and `AppDataSource.runMigrations()` as the only production schema path.
  - It distinguishes zonal failure, regional loss, operator error, destructive migration, and logical corruption instead of claiming blanket zero data loss.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `rg -n "TypeORM migrations|synchronize|expand|contract|RPO|RTO|restore" docs/architecture/adr/0001-database-schema-ownership.md` finds every policy term.
- **Estimated LOC:** +90
- **Phase:** foundation

## R2 · Create the reviewed baseline migration
- **Closes user story:** As a developer, I need a versioned baseline schema, so that an empty PostgreSQL database can be created identically in CI and production.
- **Change type:** create-new
- **File:** `backend/src/migrations/1718841600000-InitialMenuMakerSchema.ts`
- **Precise change:** Implement a TypeORM `MigrationInterface` whose `up` creates every table, enum/check constraint, foreign key, unique constraint, and index represented by the entities registered in `backend/src/config/database.ts`; implement a dependency-safe `down` for disposable test environments and include no seed or customer data.
- **Acceptance:** 
  - A clean database reaches the current entity schema with `migration:run` while `synchronize=false`.
  - Running the migration twice leaves the second run with zero pending migrations rather than duplicate-object errors.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (schema authority and destructive-change policy)
- **Test:** `npm run migrate:test:clean --workspace=backend` exits 0 against an empty disposable PostgreSQL database.
- **Estimated LOC:** +650
- **Phase:** foundation

## R3 · Make the DataSource migration-aware and fail closed
- **Closes user story:** As an operator, I need startup to reject schema drift, so that an incompatible application revision never serves traffic.
- **Change type:** modify-existing
- **File:** `backend/src/config/database.ts`
- **File:** `backend/src/main.ts`
- **File:** `backend/tests/database-config.test.ts`
- **Precise change:** Register `src/migrations/*.{ts,js}`, replace implicit `NODE_ENV` synchronization with an explicit `DB_SYNCHRONIZE_LOCAL=true` guard that is rejected in production, expose migration-table naming, and provide a startup preflight that fails when pending migrations exist unless the process is the dedicated migration job.
- **Acceptance:** 
  - `NODE_ENV=production DB_SYNCHRONIZE_LOCAL=true` terminates before database initialization with a configuration error.
  - Application startup reports pending migration IDs and refuses readiness until the migration job completes.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (baseline migration)
- **Test:** `npm run test --workspace=backend -- database-config --runInBand` covers production rejection and pending-migration behavior.
- **Estimated LOC:** +80
- **Phase:** foundation

## R4 · Add migration and schema verification commands
- **Closes user story:** As a CI maintainer, I need deterministic migration commands, so that clean installs and upgrades are machine-verifiable release gates.
- **Change type:** modify-existing
- **File:** `backend/package.json`
- **File:** `backend/scripts/migrate-test.ts`
- **File:** `backend/src/models/BusinessSettings.ts`
- **File:** `backend/src/models/ContentFlag.ts`
- **File:** `backend/src/models/Payment.ts`
- **File:** `backend/src/models/Review.ts`
- **File:** `backend/src/routes/payments.ts`
- **File:** `backend/src/services/MarketplaceService.ts`
- **File:** `backend/src/services/ReviewService.ts`
- **Precise change:** Replace the build command that swallows `tsc` failures, add `migration:run`, `migration:revert:test-only`, `migration:show`, `migrate:test:clean`, and `migrate:test:upgrade` scripts, and ensure each command uses `src/config/database.ts` with the same environment schema as the application.
- **Acceptance:** 
  - `npm run build --workspace=backend` returns the TypeScript compiler exit code without `|| exit 0`.
  - Clean and upgrade migration commands return non-zero when a migration fails or schema drift remains.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (migration-aware DataSource)
- **Test:** `npm run build --workspace=backend && npm run migrate:test:clean --workspace=backend && npm run migrate:test:upgrade --workspace=backend` exits 0.
- **Estimated LOC:** +30
- **Phase:** foundation

## R5 · Verify clean install, upgrade, rollback safety, and restore evidence
- **Closes user story:** As a product owner, I need evidence that releases preserve ordering and financial records, so that upgrades do not silently lose customer or seller state.
- **Change type:** create-new
- **File:** `backend/tests/integration/migrations.test.ts`
- **Precise change:** Use a disposable PostgreSQL database to test zero-to-current migration, upgrade from the last release fixture, representative User→Business→Menu→Order→Payment relations, non-null/index constraints, a failed destructive migration rollback, and restoration of a checksum-verified backup fixture.
- **Acceptance:** 
  - The test asserts exact row counts and primary/foreign-key identity before and after upgrade and restore.
  - Failure injection proves the migration transaction leaves the prior schema readable and records the failed migration name.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (verification commands)
- **Test:** `npm run migrate:test:clean --workspace=backend && npm test --workspace=backend -- migrations.test.ts --runInBand` exits 0.
- **Estimated LOC:** +260
- **Phase:** foundation

## What NOT to do

- Do not generate a migration by enabling synchronization against a production database.
- Do not put reference/seed data into the schema migration or make `down` destructive in production automation.
- Do not claim zero data loss without a measured restore drill and an approved regional-outage caveat.
