# Remediation Prompt — Observability, Operability, and Resilience

_Closes gap:_ G10 · observability-operability-and-resilience

## Context

The backend has useful Pino request logs and IDs but no metrics, traces, SLOs, alert routing, or dependency readiness. Operational analytics contains fabricated uptime/error numbers, Android sync prints stack traces, and iOS prints test/reset errors. Infrastructure has no dashboards, alarms, backup drill evidence, or incident runbooks.

Existing product style is authoritative for client telemetry surfaces. Any operator dashboard must define KPI, filter, chart, table, tooltip, and legend behavior, and both operator/client views must cover default, loading, empty, error, disabled, and success states.

## What to build

Implement OpenTelemetry-correlated logs/metrics/traces for Fastify/PostgreSQL/provider calls, CloudWatch/X-Ray export, platform crash/error telemetry, dependency health/readiness, SLO-based alerts, synthetic seller/customer/payment checks, redaction controls, resilience policies, and evidence-producing incident/restore drills.

## Implementation guidance

## R1 · Define service objectives and telemetry taxonomy
- **Closes user story:** As an on-call engineer, I need agreed service objectives and signal names, so that alerts reflect user impact rather than arbitrary infrastructure noise.
- **Change type:** create-new
- **File:** `docs/operations/slo-catalog.yaml`
- **File:** `scripts/observability/validate_slos.py`
- **Precise change:** Define availability/latency/correctness SLOs for auth, public menu, order creation/status, payment webhook, seller mutation, media, notification outbox, and background sync; specify SLIs, windows, error budgets, owners, page/ticket thresholds, exclusions, and no-data behavior.
- **Acceptance:** 
  - Tier 0 order/payment SLIs include duplicate/lost/invalid-transition correctness, not HTTP 2xx alone.
  - Every page alert links an owner, runbook, severity, and customer-impact statement.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `python3 scripts/observability/validate_slos.py docs/operations/slo-catalog.yaml` rejects missing owner/query/threshold/runbook.
- **Estimated LOC:** +220
- **Phase:** foundation

## R2 · Instrument Fastify, PostgreSQL, and integrations
- **Closes user story:** As an operator, I need correlated traces, metrics, and redacted logs, so that I can locate failures across requests, transactions, and providers.
- **Change type:** create-new
- **File:** `backend/src/observability/telemetry.ts`
- **File:** `backend/tests/telemetry.test.ts`
- **Precise change:** Initialize OpenTelemetry resources with service/version/environment; instrument HTTP/Fastify/PostgreSQL and explicit Stripe/Twilio/Anthropic/POS/delivery spans; record RED metrics and domain counters; propagate W3C trace context/request IDs; configure Pino redaction for authorization/cookies/tokens/passwords/payment/PII; batch export to AWS X-Ray/CloudWatch via OTLP.
- **Acceptance:** 
  - One order/payment test links request, SQL transaction, provider call, outbox event, and worker spans under one trace without sensitive values.
  - Route labels are bounded templates, not raw URLs/user IDs, and telemetry export failure never blocks Tier 0 state commits.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (signal taxonomy)
- **Test:** `npm test --workspace=backend -- telemetry.test.ts --runInBand` verifies correlation, cardinality, redaction, and exporter failure.
- **Estimated LOC:** +360
- **Phase:** foundation

## R3 · Split liveness, readiness, and diagnostics
- **Closes user story:** As a platform operator, I need health endpoints with correct semantics, so that orchestration stops traffic without restarting healthy-but-unready processes endlessly.
- **Change type:** create-new
- **File:** `backend/src/routes/health.ts`
- **File:** `backend/tests/health.test.ts`
- **Precise change:** Expose lightweight `/health/live`, dependency-aware `/health/ready`, and authenticated admin diagnostics; readiness checks database migration/pool, required secrets/capabilities, and outbox backlog thresholds with per-check timeouts; never expose versions/credentials/internal addresses publicly.
- **Acceptance:** 
  - Database loss makes readiness non-2xx while liveness remains 2xx until the process is actually wedged.
  - Startup, drain, migration, and dependency-degraded transitions have integration tests and ECS grace-period settings.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (health metrics/traces)
- **Test:** `npm test --workspace=backend -- health.test.ts --runInBand` covers live/ready/degraded/draining states.
- **Estimated LOC:** +160
- **Phase:** foundation

## R4 · Provision dashboards, alerts, synthetics, and retention
- **Closes user story:** As an on-call engineer, I need actionable dashboards and routed alerts, so that customer-impacting failures are detected before support reports them.
- **Change type:** create-new
- **File:** `infrastructure/modules/environment/observability.tf`
- **File:** `scripts/observability/verify_alert_coverage.py`
- **Precise change:** Provision CloudWatch log groups/retention, metrics/alarms, X-Ray, dashboard, SNS routing, budget alarm, and scheduled synthetics for public menu, auth, order, and signed payment-event canary; alert on SLO burn, 5xx/latency, RDS/storage, migration failure, outbox/DLQ lag, payment signature failures, and backup status.
- **Acceptance:** 
  - Critical pages require sustained multi-window burn or Tier 0 correctness failure and link to versioned runbooks.
  - Staging proves each alert via controlled injection; production alert destinations and escalation acknowledgements are tested quarterly.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-executable-fail-closed-delivery-pipeline.md (environment module), R3 (health semantics)
- **Test:** `terraform -chdir=infrastructure validate && python3 scripts/observability/verify_alert_coverage.py docs/operations/slo-catalog.yaml infrastructure/modules/environment/observability.tf` exits 0.
- **Estimated LOC:** +420
- **Phase:** foundation

## R5 · Add structured mobile/web error and sync telemetry
- **Closes user story:** As a support engineer, I need privacy-safe client failure signals, so that crashes and failed offline sync can be diagnosed by app version and operation.
- **Change type:** create-new
- **File:** `frontend/src/components/common/ErrorBoundary.tsx`
- **File:** `frontend/src/observability/errorReporter.ts`
- **File:** `frontend/src/observability/errorReporter.test.ts`
- **File:** `frontend/scripts/run-tests.js`
- **File:** `android/app/src/main/kotlin/com/menumaker/observability/TelemetryReporter.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/observability/TelemetryReporterTest.kt`
- **File:** `ios/MenuMaker/Shared/Utilities/TelemetryReporter.swift`
- **File:** `ios/MenuMakerTests/TelemetryReporterTests.swift`
- **Precise change:** Define a shared event taxonomy and platform adapters: web reports fatal boundary/API failures; Android uses structured Timber/Crashlytics events and WorkManager sync metrics; iOS uses `Logger` signposts plus Xcode Organizer/crash metadata; attach release/environment/operation/error-code/correlation ID but no tokens, addresses, phone/email, payment metadata, or request bodies.
- **Acceptance:** 
  - Forced debug crashes and sync failures appear in the correct non-production project with symbolication/source maps and correlation IDs.
  - Automated redaction tests reject sensitive keys and values before exporter calls.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (taxonomy/correlation; platform adapters consume the stable interface)
- **Test:** `npm run test:ci --workspace=frontend -- errorReporter.test.ts` plus platform telemetry unit suites exit 0.
- **Estimated LOC:** +220
- **Phase:** foundation

## R6 · Create incident, rollback, backup, and restore runbooks
- **Closes user story:** As an incident commander, I need rehearsed recovery procedures, so that the team can restore service and prove data integrity within approved targets.
- **Change type:** create-new
- **File:** `docs/operations/runbooks/index.md`
- **File:** `scripts/operations/validate_runbooks.py`
- **Precise change:** Link runbooks for API outage, database failover/restore, bad migration, payment webhook backlog, duplicate order/payment suspicion, credential compromise, media outage, outbox/DLQ replay, mobile bad release, and Terraform drift; each includes detection, customer impact, containment, evidence capture, approval, recovery, verification, communication, and postmortem.
- **Acceptance:** 
  - Quarterly staging drills produce timestamps, commands, checksums, restored row/invariant checks, actual RPO/RTO, gaps, and named follow-ups.
  - Replay/restore tools require explicit environment, dry-run summary, approval identity, idempotency key, and immutable evidence output.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (alerts/synthetics), remediation-executable-fail-closed-delivery-pipeline.md (deployment verification)
- **Test:** `python3 scripts/operations/validate_runbooks.py docs/operations/runbooks docs/operations/slo-catalog.yaml` exits 0.
- **Estimated LOC:** +360
- **Phase:** foundation

## What NOT to do

- Do not use fabricated operational metrics or page on raw log strings without user-impact semantics.
- Do not attach raw URLs, tokens, request bodies, PII, payment metadata, or secrets to telemetry.
- Do not claim recovery targets without dated drill evidence.
