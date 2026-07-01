# MenuMaker Operations Runbooks

These runbooks are versioned operational procedures for MenuMaker staging and production. Each incident must preserve evidence under the deployment evidence bucket or the incident artifact produced by the deploy workflow. Recovery targets are goals until a dated staging drill proves the actual RPO/RTO.

## Quarterly drill evidence template

Every quarterly staging drill records:

- Start and end timestamps in UTC.
- Operator, approver, environment, and incident/runbook ID.
- Commands run, artifact checksums, database snapshot/restore identifiers, restored row counts, invariant checks, and application smoke-check outputs.
- Actual RPO and RTO measured from timestamps.
- Gaps, named follow-ups, owner, and due date.
- Immutable evidence output path and checksum.

Replay and restore tools must require: explicit environment, dry-run summary, approval identity, idempotency key, and immutable evidence output before changing state.

<a id="api-outage-and-auth-failure"></a>

## API outage and auth failure

- **Detection:** `api_5xx`, `api_latency_p95`, `auth_api_availability`, and synthetic auth canary alerts.
- **Customer impact:** Users cannot sign in, load menus, place orders, or manage seller workflows.
- **Containment:** Freeze production deploys, identify last successful artifact manifest, and check `/health/live` versus `/health/ready`.
- **Evidence capture:** Save CloudWatch dashboard URL, X-Ray trace IDs, ECS task definition, ALB target health, and deploy manifest checksum.
- **Approval:** Incident commander approves rollback; database migrations are forward-fixed unless a separate data restore runbook is invoked.
- **Recovery:** Roll back ECS service to the previous task definition or promote the previous image digest through the deploy workflow.
- **Verification:** `scripts/release/verify-deployment.sh --environment production --expected-manifest <manifest>` plus auth canary success.
- **Communication:** Update customer-impact channel every 30 minutes for SEV1/SEV2.
- **Postmortem:** Record root cause, error-budget impact, and follow-up owners within two business days.

<a id="database-failover-restore-and-bad-migration"></a>

## Database failover, restore, and bad migration

- **Detection:** RDS failover events, backup-status alarm, migration-failure alarm, readiness database check, and order/payment correctness SLOs.
- **Customer impact:** Orders, payments, menus, and user sessions may be unavailable or inconsistent.
- **Containment:** Stop write-heavy deploy steps, disable nonessential workers, and preserve the failed migration log.
- **Evidence capture:** Snapshot IDs, PITR target, migration name, checksums, row counts, invariant queries, and restored database endpoint.
- **Approval:** Data owner and incident commander approve restore/failover. Destructive migration reversal needs explicit written approval.
- **Recovery:** Prefer RDS Multi-AZ failover for instance failure; use point-in-time restore for operator/data corruption; run migrations once after restore.
- **Verification:** Compare restored order/payment counts, duplicate/lost/invalid-transition queries, API smoke, and payment webhook replay dry run.
- **Communication:** Declare whether RPO/RTO were met using measured timestamps, not estimates.
- **Postmortem:** Add schema guardrails or migration tests for every preventable failure.

<a id="payment-webhook-backlog"></a>

## Payment webhook backlog

- **Detection:** `payment_signature_failures`, payment webhook queue age, payment correctness, and signed payment-event canary alerts.
- **Customer impact:** Paid orders may remain pending, duplicate, or incorrectly refunded.
- **Containment:** Pause nonessential webhook workers only if idempotency keys are confirmed; never drop signed events.
- **Evidence capture:** Stripe event IDs, signature verification result, idempotency keys, queue offsets, and affected order/payment IDs.
- **Approval:** Payments owner approves replay; finance owner approves customer communication for money movement.
- **Recovery:** Replay signed events by idempotency key in dry-run, then approved live mode; do not synthesize unsigned payment success.
- **Verification:** Payment/order invariant query shows no duplicate/lost/invalid-transition records; customer/seller smoke succeeds.
- **Communication:** Support receives affected order IDs and approved customer language.
- **Postmortem:** Add missing signature, idempotency, or reconciliation tests.

<a id="duplicate-order-or-payment-suspicion"></a>

## Duplicate order or payment suspicion

- **Detection:** Tier 0 correctness alarm for duplicate, lost, or invalid-transition order/payment events.
- **Customer impact:** Customers may be charged twice, miss an order, or see an impossible status.
- **Containment:** Freeze automated retries for the affected idempotency scope and preserve the event log.
- **Evidence capture:** Correlation ID, trace ID, command ID, idempotency key, order/payment state transitions, and provider event IDs.
- **Approval:** Incident commander and payments/ordering owners approve replay or compensation actions.
- **Recovery:** Reconcile from canonical PostgreSQL state and provider event history; issue refunds/credits only through approved payment tools.
- **Verification:** Invariant checks report zero duplicates, lost events, and invalid transitions for the incident window.
- **Communication:** Support receives customer-facing status and compensation plan.
- **Postmortem:** Add replay fixture and SLO coverage for the failure mode.

<a id="media-and-public-menu-outage"></a>

## Media and public menu outage

- **Detection:** Public menu canary, CloudFront 5xx, media delivery success, and S3 access alarms.
- **Customer impact:** Diners cannot view menus or images; sellers may fail uploads.
- **Containment:** Stop destructive media changes and preserve object versions.
- **Evidence capture:** S3 object version IDs, CloudFront distribution ID, invalidation IDs, failed URL checks, and checksum manifest.
- **Approval:** Frontend/platform owner approves web artifact rollback.
- **Recovery:** Restore prior S3 object prefix or object versions and invalidate CloudFront paths.
- **Verification:** Public menu canary and synthetic media access succeed with expected checksums.
- **Communication:** Notify sellers if uploads were delayed or images restored.
- **Postmortem:** Add object lifecycle or cache invalidation guardrail.

<a id="outbox-dlq-replay-and-stale-order-status"></a>

## Outbox DLQ replay and stale order status

- **Detection:** Outbox/DLQ lag alarm, order status freshness SLO, and mobile sync telemetry.
- **Customer impact:** Customers and restaurants see stale status or miss notifications.
- **Containment:** Stop duplicate workers and snapshot queue/backlog state.
- **Evidence capture:** Queue depth, event IDs, ordering keys, replay cursor, dry-run summary, and correlation IDs.
- **Approval:** Messaging owner approves replay with an idempotency key.
- **Recovery:** Replay DLQ/outbox in ordering-key order; skip events already materialized.
- **Verification:** Projection checkpoint advances and stale order status SLO returns to green.
- **Communication:** Support receives affected order IDs and expected catch-up time.
- **Postmortem:** Add replay fixture and worker backpressure alarms.

<a id="credential-compromise"></a>

## Credential compromise

- **Detection:** Security event logs, unusual auth failures, secret-rotation alerts, or provider notification.
- **Customer impact:** Account, payment, or integration data could be exposed or misused.
- **Containment:** Revoke affected credentials, rotate Secrets Manager versions, disable impacted integration capabilities, and preserve audit logs.
- **Evidence capture:** Secret ARN/version, access trail, affected systems, revocation timestamp, and validation commands.
- **Approval:** Security owner and incident commander approve customer/regulatory notification path.
- **Recovery:** Deploy rotated secret references, restart ECS tasks, and verify no plain secret values entered Terraform state.
- **Verification:** Authentication, payment, and provider smoke tests pass with new secret versions.
- **Communication:** Follow privacy/security notification procedures when required.
- **Postmortem:** Add detection or least-privilege control for the leak path.

<a id="mobile-bad-release-and-sync-failure"></a>

## Mobile bad release and sync failure

- **Detection:** Crash telemetry, forced debug crash checks, background sync SLO, app-version error spikes, and support reports.
- **Customer impact:** Mobile users may crash, fail checkout, or lose offline sync progress.
- **Containment:** Halt rollout, disable risky server-side capability flags, and preserve symbolication/source-map references.
- **Evidence capture:** App version, build number, platform, operation, correlation IDs, redacted crash metadata, and rollout percentage.
- **Approval:** Product and mobile owners approve rollback or staged rollout pause.
- **Recovery:** Roll back store rollout where possible or ship hotfix; keep server compatibility for the previous app version.
- **Verification:** Non-production forced crash/sync failure appears in the correct telemetry project and redaction tests pass.
- **Communication:** Publish app-store/customer support guidance when users must update.
- **Postmortem:** Add regression test or feature-flag kill switch for the failure.

<a id="terraform-drift"></a>

## Terraform drift

- **Detection:** Terraform plan drift, unexpected AWS Config/CloudTrail changes, or deploy workflow drift evidence.
- **Customer impact:** Infrastructure may diverge from reviewed security, availability, or cost assumptions.
- **Containment:** Freeze applies outside the protected deploy workflow and export current state.
- **Evidence capture:** Plan output, state version, actor identity, changed resources, and artifact checksum.
- **Approval:** Platform owner approves import/reconcile/destroy plan.
- **Recovery:** Reconcile through reviewed Terraform plan; never hand-edit production as the final state.
- **Verification:** `terraform -chdir=infrastructure plan` returns no unreviewed drift after apply/import.
- **Communication:** Notify on-call and security if drift touched network, IAM, secrets, or data stores.
- **Postmortem:** Tighten permissions or drift detection cadence.
