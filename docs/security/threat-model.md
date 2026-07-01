# MenuMaker Threat Model and Control Matrix

Review date: 2026-06-20
Owner: privacy-security
Method: STRIDE plus privacy abuse cases, following OWASP threat-modeling guidance (SRC-034, SRC-035).

## Scope and assets

In scope: web/browser session, native mobile credential storage, Fastify API, admin/RBAC and support access, PostgreSQL/RDS, S3 media uploads, Stripe and subscription webhooks, payment/integration credentials, Twilio/Firebase/Anthropic processors, CI/CD workflows, backups, release evidence, and GDPR export/deletion workflows.

Primary assets: account identity, contact details, addresses/location, order/payment metadata, tax invoices, media uploads, refresh sessions, provider credentials, audit records, operational logs, backups, and release artifacts.

## Trust boundaries

| Boundary | Entry points | Sensitive data | Primary controls |
|---|---|---|---|
| Browser to API | `/api/v1/auth`, seller/customer APIs | cookies, CSRF token, profile/order data | HttpOnly refresh cookie, short-lived access token, CSRF rejection, RBAC, telemetry redaction |
| Native app to API | Retrofit/Swift API client | bearer access token, native refresh credential | typed access/refresh lifecycle, Android secure storage, iOS Keychain, TLS |
| API to PostgreSQL | TypeORM repositories | identity, orders, tax, credentials metadata | migrations, bounded context ownership, field inventory, credential envelope encryption |
| API to Stripe/Twilio/Firebase/Anthropic | SDK/API calls and webhooks | payment metadata, phone/device token/media | exact webhook raw body, signature verification, processor disclosure, no PAN/CVV storage |
| Admin/support | admin routes and diagnostics | cross-tenant support data | least-privilege roles, ticketed access, audit logs, break-glass expiry |
| CI/CD and release | GitHub Actions, Terraform, artifacts | source, secrets, deployment role | full-SHA actions, least permissions, security gate, immutable artifacts |
| Backup/export | S3/RDS backup and DSAR packages | complete subject datasets | checksum manifest, short export retention, legal-hold rationale, backup expiry evidence |

## Threats and controls

| ID | Threat | STRIDE/privacy class | Severity | Preventive controls | Detective controls | Verification command | Owner | Residual risk |
|---|---|---|---|---|---|---|---|---|
| T01 | Cross-tenant access or IDOR exposes another seller/customer record. | Information disclosure / authorization | critical | Bounded context ownership, user/business scoping, RBAC checks, no decrypted provider credentials on list/read paths. | AuditLog, RED metrics, security event logging. | `npm test --workspace=backend -- GDPRService.integration.test.ts --runInBand` | backend-platform | Medium until every route has route-level tenancy tests. |
| T02 | Stolen refresh token is replayed after rotation/logout. | Spoofing / session privacy | high | RefreshSession family rotation and reuse revocation; access/refresh token type separation. | reuse_detected_at evidence, auth telemetry. | `npm test --workspace=backend -- auth-session-routes.test.ts --runInBand` | identity | Low. |
| T03 | Stripe webhook forgery, replay, or body mutation creates fake payment success. | Tampering / repudiation | critical | exact raw-body capture, Stripe signature verification, event-id dedupe, test-only fake charge route. | payment webhook duplicate/security metrics. | `NODE_ENV=test ENABLE_FAKE_PAYMENTS=true npm test --workspace=backend -- payment-webhook.integration.test.ts --runInBand` | payments | Low after persistent event receipts are database-backed. |
| T04 | Provider/integration credential database leak exposes seller accounts. | Information disclosure | critical | PaymentProcessor envelope encryption, per-business encryption context, masked metadata, no decrypt on list/read paths. | decrypt audit trail, corrupt/unauthorized decrypt failures. | `npm test --workspace=backend -- credential-encryption.test.ts --runInBand` | payments | Medium until production AWS KMS grants are exercised in staging. |
| T05 | Malicious upload or OCR prompt leaks secrets or executes unsafe content. | Tampering / privacy | high | media type/size controls, S3 isolation, OCR disabled without explicit key, no raw media in logs. | media/OCR telemetry and processor ledger. | `python3 scripts/security/verify_data_inventory.py docs/security/data-inventory.yaml backend/src/models frontend/src android/app/src/main ios/MenuMaker` | media | Medium pending upload scanner task. |
| T06 | Logs/backups retain personal data or secrets after account deletion. | Privacy / information disclosure | high | data inventory retention rules, log redaction, GDPR legal-hold rationale, backup-expiry evidence. | deletion manifest checksum and retained-record evidence. | `npm test --workspace=backend -- GDPRService.integration.test.ts --runInBand` | privacy-security | Medium because backup physical erasure follows retention windows. |
| T07 | Mutable dependency/action compromise alters build or deploy. | Tampering / elevation of privilege | critical | full-SHA action pins, least-privilege permissions, release-security gate, immutable artifact manifest. | CI audit evidence, SBOM/provenance metadata. | `bash scripts/security/release-security-gate.sh --fixtures scripts/security/fixtures` | release | Low for CI YAML; dependency zero-day remains medium. |
| T08 | Break-glass/support user accesses customer data without business need. | Elevation of privilege / privacy | high | support ticket requirement, role scoping, expiry, no credential decrypt without explicit privileged path. | AuditLog support access and diagnostics auth. | `npm test --workspace=backend -- health.test.ts --runInBand` | support | Medium until admin UI enforces all ticket checks. |
| T09 | Mobile permission creep collects location/camera/photos/notifications beyond active features. | Privacy | high | mobile-data-practices manifest, just-in-time permission copy, removal of unused broad iOS strings and Android cleartext traffic. | static mobile permission verifier. | `python3 scripts/release/verify_mobile_data_practices.py docs/release/mobile-data-practices.yaml ios/MenuMaker/Info.plist android/app/src/main/AndroidManifest.xml` | mobile | Low. |
| T10 | GDPR export includes secrets or another tenant's records, or deletion marks complete without provider/blob evidence. | Privacy / information disclosure / repudiation | critical | signed export manifest, secret exclusion, tenant isolation, resumable deletion steps, processor status. | checksum and per-location evidence. | `npm test --workspace=backend -- GDPRService.integration.test.ts --runInBand` | privacy-security | Medium until real provider APIs are enabled. |

## Release control matrix

| Control | Source / implementation | Evidence |
|---|---|---|
| Field inventory has no unknown purpose, retention, processor, or deletion handling. | `docs/security/data-inventory.yaml`; GDPR Articles 15/17 handling from SRC-029/SRC-030. | `python3 scripts/security/verify_data_inventory.py ...` |
| App Store and Play privacy declarations are accurate and current. | `docs/release/mobile-data-practices.yaml`; Apple and Google requirements from SRC-031/SRC-032/SRC-033. | `python3 scripts/release/verify_mobile_data_practices.py ...` |
| Provider credentials are protected independently of database rows. | `backend/src/models/PaymentProcessor.ts`; AWS KMS context/envelope guidance from SRC-036/SRC-037. | `npm test --workspace=backend -- credential-encryption.test.ts --runInBand` |
| CI/release supply chain is immutable and least-privilege. | `.github/workflows/smart-ci.yml`; GitHub secure use guidance from SRC-038. | `bash scripts/security/release-security-gate.sh --ci-contract-only` |
| Sensitive logs are redacted and release evidence avoids overclaiming. | observability telemetry plus release security gate; OWASP logging guidance from SRC-039. | `npm test --workspace=backend -- telemetry.test.ts --runInBand`; release evidence JSON |

## Review cadence

Threats rated critical/high must be reviewed before every production release and after any incident involving auth, payment, provider credentials, uploads, mobile permission changes, CI/CD, or privacy requests.
