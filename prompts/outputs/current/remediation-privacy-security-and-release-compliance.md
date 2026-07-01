# Remediation Prompt — Privacy, Security, and Release Compliance

_Closes gap:_ G11 · privacy-security-and-release-compliance

## Context

MenuMaker processes identity/contact data, delivery addresses/location, payment metadata, tax records, media, tokens, reviews, and admin audit data. GDPR routes and guides exist, but there is no authoritative field-level classification/retention map, deletion proof across every table/blob/cache/provider, encrypted payment-processor credential boundary, mobile permission inventory, or release privacy evidence. CI also relies on mutable action tags and broad implicit permissions.

## What to build

Create an evidence-based privacy/security program embedded in code: data inventory and threat model, purpose/retention/access rules, verified export/deletion workflows, envelope encryption and rotation for integration credentials, least-privilege logs/CI/mobile permissions, data-safety/privacy manifests, dependency/secret scanning, and release evidence mapped to concrete controls rather than readiness claims.

Permission and privacy UI must follow this rule: existing product style is authoritative. Cover default, loading, empty, error, disabled, and success/consent-confirmed states with accessible recovery paths.

## Implementation guidance

## R1 · Classify data, purpose, retention, and processors
- **Closes user story:** As a privacy owner, I need a field-level data inventory, so that collection, access, retention, export, and deletion are deliberate and auditable.
- **Change type:** create-new
- **File:** `docs/security/data-inventory.yaml`
- **File:** `scripts/security/verify_data_inventory.py`
- **Precise change:** Enumerate every entity field, log/trace attribute, upload/blob, mobile cache/preference/keychain/Room record, analytics event, backup, and third-party processor with classification, subject, purpose, legal basis, consent capture for optional tracking/processing, source, owner, readers/writers, encryption, residency, retention, export/deletion behavior, and downstream processors.
- **Acceptance:**
  - A schema/source scanner reports every TypeORM column and known client persistence key exactly once.
  - Unknown retention, purpose, processor, or deletion handling blocks release instead of defaulting to indefinite storage.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `python3 scripts/security/verify_data_inventory.py docs/security/data-inventory.yaml backend/src/models frontend/src android/app/src/main ios/MenuMaker` exits 0.
- **Estimated LOC:** +420
- **Phase:** foundation

## R2 · Publish the threat model and control matrix
- **Closes user story:** As a security reviewer, I need threats mapped to implemented controls, so that high-risk payment, identity, admin, upload, and integration boundaries have testable defenses.
- **Change type:** create-new
- **File:** `docs/security/threat-model.md`
- **File:** `scripts/security/validate_threat_model.py`
- **Precise change:** Model assets, trust boundaries, actors, abuse cases, and STRIDE/privacy threats for web/browser session, mobile storage, Fastify/API, admin/RBAC, PostgreSQL, media uploads/S3, Stripe/webhooks, POS/delivery/Twilio/Anthropic, CI/CD, backups, and support access; link controls, tests, residual risk, owner, and review date.
- **Acceptance:**
  - Threats include cross-tenant access, IDOR, refresh replay, webhook forgery/replay, fake payment success, malicious upload/OCR, log/backup leakage, dependency/action compromise, and break-glass misuse.
  - Critical/high threats have preventive and detective controls plus named verification commands.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (data/process inventory)
- **Test:** `python3 scripts/security/validate_threat_model.py docs/security/threat-model.md docs/security/data-inventory.yaml` exits 0.
- **Estimated LOC:** +360
- **Phase:** foundation

## R3 · Make GDPR export and deletion complete and provable
- **Closes user story:** As a user, I need export and deletion to cover every MenuMaker copy of my data, so that privacy controls match the data actually held.
- **Change type:** modify-existing
- **File:** `backend/src/services/GDPRService.ts`
- **File:** `backend/src/services/MediaService.ts`
- **File:** `backend/src/routes/media.ts`
- **File:** `backend/tests/GDPRService.integration.test.ts`
- **File:** `backend/tests/MediaService.test.ts`
- **Precise change:** Derive a data export and data deletion plan from the inventory; include all owned/related tables, object-storage keys, notifications, audit-preserved pseudonymous records, processor requests, local stores/mobile cache invalidation, legal-hold exceptions, and backup expiry; create a signed export JSON manifest/checksum, resumable job state, approval for destructive execution, and evidence without exporting secrets/other tenants.
- **Acceptance:**
  - Integration fixtures populate every data location and prove export completeness, tenant isolation, deletion/anonymization outcome, processor status, and retained-record rationale.
  - Failed provider/blob/table steps resume idempotently and never mark complete until every required location has evidence.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (complete inventory)
- **Test:** `npm test --workspace=backend -- GDPRService.integration.test.ts --runInBand` exits 0 with complete/hold/retry/cross-tenant fixtures.
- **Estimated LOC:** +420
- **Phase:** foundation

## R4 · Encrypt and rotate third-party credentials
- **Closes user story:** As a seller, I need processor and integration credentials protected independently of the database, so that a database leak does not expose provider accounts.
- **Change type:** modify-existing
- **File:** `backend/src/models/PaymentProcessor.ts`
- **File:** `backend/tests/credential-encryption.test.ts`
- **Precise change:** Replace plaintext credential JSON with envelope-encrypted ciphertext, KMS key/version/context, algorithm/version, created/rotated timestamps, and masked metadata; use AWS KMS/Secrets Manager adapters, per-business authenticated context, no decrypt on list/read paths, rotation job with dual-read/single-write transition, and audit all privileged decrypts.
- **Acceptance:**
  - Database dumps contain no provider secret/token plaintext and ciphertext cannot decrypt under another business/context.
  - Rotation, disabled old key, corrupt ciphertext, KMS outage, unauthorized read, and redacted logging are tested.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-executable-fail-closed-delivery-pipeline.md (KMS/Secrets Manager infrastructure), R2 (threat/control decision)
- **Test:** `npm test --workspace=backend -- credential-encryption.test.ts --runInBand` exits 0.
- **Estimated LOC:** +260
- **Phase:** foundation

## R5 · Minimize permissions, logs, and mobile privacy declarations
- **Closes user story:** As a mobile user, I need clear permission purpose and accurate data declarations, so that the apps collect only what their active features require.
- **Change type:** create-new
- **File:** `docs/release/mobile-data-practices.yaml`
- **File:** `scripts/release/verify_mobile_data_practices.py`
- **File:** `ios/MenuMaker/Info.plist`
- **File:** `android/app/src/main/AndroidManifest.xml`
- **Precise change:** Map iOS Info.plist/entitlements and Android Manifest/SDK permissions to feature, data category, purpose, optionality, retention, sharing, tracking, and denial behavior; remove unused broad permissions; add just-in-time camera/photos/location/notifications education and graceful denial; derive App Store privacy nutrition and Play Data Safety answers from the same file.
- **Acceptance:**
  - Static scans find no permission, SDK data collection, analytics/crash field, or background access missing from the manifest.
  - UI tests prove denied/limited permissions preserve unrelated flows and settings can revisit consent.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (data inventory)
- **Test:** `python3 scripts/release/verify_mobile_data_practices.py docs/release/mobile-data-practices.yaml ios/MenuMaker/Info.plist android/app/src/main/AndroidManifest.xml` exits 0.
- **Estimated LOC:** +260
- **Phase:** foundation

## R6 · Harden CI supply chain and produce release security evidence
- **Closes user story:** As a release approver, I need reproducible security evidence, so that mutable dependencies or leaked secrets cannot silently enter production.
- **Change type:** create-new
- **File:** `scripts/security/release-security-gate.sh`
- **File:** `scripts/security/fixtures/release-security/good/workflow.yml`
- **File:** `scripts/security/fixtures/release-security/mutable-action/workflow.yml`
- **File:** `scripts/security/fixtures/release-security/excessive-permission/workflow.yml`
- **File:** `scripts/security/fixtures/release-security/secret/config.env`
- **File:** `scripts/security/fixtures/release-security/vulnerability/npm-audit.json`
- **File:** `scripts/security/fixtures/release-security/license/package-lock.json`
- **File:** `scripts/security/fixtures/release-security/expired-exception/exceptions.yaml`
- **Precise change:** Verify full-SHA GitHub Action pins and least-privilege permissions; scan committed history/candidate artifacts for secrets; audit npm/Gradle/Swift dependencies and licenses; generate SBOMs and provenance; run SAST, IaC, container, OpenAPI auth, and mobile manifest checks; enforce approved exceptions with owner/expiry and emit signed evidence linked to artifact digest.
- **Acceptance:**
  - A critical vulnerability, detected secret, mutable action tag, excessive workflow permission, unapproved license, or expired exception returns non-zero.
  - Evidence identifies tool/database timestamps and does not claim compliance beyond tested controls.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (control matrix; CI integration is added through the delivery workflow contract)
- **Test:** `bash scripts/security/release-security-gate.sh --fixtures scripts/security/fixtures` accepts the good fixture and rejects every seeded violation.
- **Estimated LOC:** +300
- **Phase:** foundation

## R7 · Require privacy and security gates in CI
- **Closes user story:** As a release approver, I need privacy/security gates to run automatically, so that release evidence cannot depend on manual local execution.
- **Change type:** modify-existing
- **File:** `.github/workflows/smart-ci.yml`
- **Precise change:** Add CI steps for the Task 8 data-inventory, threat-model, GDPR, credential-encryption, mobile-data-practices, and release-security gates, preserving the fail-closed pinned-action and least-privilege workflow contract.
- **Acceptance:**
  - The workflow includes each Task 8 named verification command and fails if any gate returns non-zero.
  - Workflow permissions remain least-privilege and action references remain full-SHA pinned.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1, R2, R3, R4, R5, R6 (CI cannot require the privacy/security gates until those commands and artifacts exist)
- **Test:** `python3 scripts/ci/audit_workflows.py .github/workflows/smart-ci.yml && bash scripts/security/release-security-gate.sh --ci-contract-only` exits 0.
- **Estimated LOC:** +40
- **Phase:** foundation

## What NOT to do

- Do not infer legal basis or retention from old readiness guides; unresolved policy remains a release blocker for the affected market.
- Do not encrypt with application-managed static keys stored beside ciphertext or return decrypted credentials through APIs.
- Do not claim GDPR/PCI/store compliance from documentation alone; link each claim to current code, tests, and evidence.
