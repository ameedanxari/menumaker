---
Status: current
Owner: product-platform
Review cadence: per remediation checkpoint and before each release candidate
Last reviewed: 2026-06-20
---

# MenuMaker product status

## Release posture

MenuMaker is not production-ready yet. The remediation executor has completed its planned G1–G14 work and local build/web/iOS smoke evidence is green. This follow-up pass repaired the plan/path ledger, added a first-party admin web route, scrubbed disabled-capability claims from launch UI surfaces, and closed the tracked profile/media/notification/error-monitoring/sample-data TODOs. Go-live still needs real production environment evidence, mobile distribution evidence, Android device execution evidence, and live-provider credential/smoke evidence.

## Production-ready criteria

Use that release label only when all of these are true:

1. `prompts/outputs/current/execution-log.md` reports `next_task: null` and every remediation task is accounted for by the honest-handoff gate.
2. `bash .ai-prompts/scripts/build-gate.sh` passes for every detected stack.
3. Required security, privacy, release, migration, contract, capability, and repository-hygiene gates pass with dated evidence.
4. Environment-specific deploy, rollback, restore, monitoring, and synthetic-check evidence exists for the actual release target.
5. Android and iOS release candidates install and execute launch-scope smoke flows through internal testing tracks or equivalent signed distribution.
6. Remaining disabled capabilities are either removed from customer-facing claims or explicitly accepted as out of launch scope.
7. Known environment limitations, missing credentials, and manual release prerequisites are either resolved or approved as release exceptions.

## Current evidence snapshot

| Scope | Current state | Evidence path | Verification command | Timestamp | Confidence |
|---|---|---|---|---|---|
| G1–G14 remediation execution | completed / green | `prompts/outputs/current/execution-log.md` | `bash .ai-prompts/scripts/validate-execution-envelope.sh prompts/outputs/current` | 2026-06-20T16:48:54Z | high |
| Honest handoff | pass, 91/91 plan tasks accounted for | `prompts/outputs/current/envelope-report.md` | `bash .ai-prompts/scripts/validate-execution-envelope.sh prompts/outputs/current` | 2026-06-20T16:48:54Z | high |
| Multi-stack compile/build gate | pass | `prompts/outputs/current/execution-log.md` | `PATH="$PWD/.tools/bin:$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" DEVELOPER_DIR="/Applications/Xcode-27.0.0-Beta.app/Contents/Developer" bash .ai-prompts/scripts/build-gate.sh` | 2026-06-20T21:04:00Z | high |
| Web primary E2E suite | pass, 75 Chromium tests including first-party `/admin` portal role-boundary smoke | `frontend/tests/e2e` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" CI=1 npm run test:e2e --workspace=frontend -- --project=chromium` | 2026-06-20T23:23:18Z | high |
| iOS fake-backend smoke | pass, Business transport plus Customer payment/image slices | `ios/MenuMakerTests` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" DEVELOPER_DIR="/Applications/Xcode-27.0.0-Beta.app/Contents/Developer" npm run test:ios:fake` | 2026-06-20T21:09:29Z | medium |
| Android connected fake-backend smoke | UNVERIFIED, local run failed at device discovery | `android/build/reports/problems/problems-report.html` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run test:android:fake` | 2026-06-20T21:10:00Z | high for environment blocker |
| Contract fixtures and strict compiler baseline | pass | `shared/mocks/manifest.json` | `node shared/fake-backend/validate-fixtures.js openapi/menumaker.v1.yaml shared/mocks/manifest.json && node scripts/quality/verify-strict-compiler-baseline.mjs && node --import tsx scripts/quality/build-quality-report.ts --fixtures scripts/quality/fixtures` | 2026-06-20T21:10:00Z | high |
| Documentation lifecycle | pass, 110 worktree-present docs/reports classified | `docs/governance/document-inventory.csv` | `python3 scripts/docs/check_all.py` | 2026-06-20T22:57:41Z | high |
| Release security / repository hygiene / workflow audit | pass | `.github/workflows/smart-ci.yml` | `bash scripts/security/release-security-gate.sh --ci-contract-only && bash scripts/cleanup/verify-repository-hygiene.sh && python3 scripts/ci/audit_workflows.py .github/workflows/smart-ci.yml` | 2026-06-20T21:04:00Z | high |
| Terraform shape | valid after local init | `infrastructure/main.tf` | `terraform -chdir=infrastructure init -backend=false && terraform -chdir=infrastructure validate` | 2026-06-20T21:05:00Z | medium |
| Offline production Terraform plan | generated against placeholder inputs | `infrastructure/environments/prod.tfvars` | `terraform -chdir=infrastructure plan -input=false -var-file=environments/prod.tfvars -out=/tmp/menumaker-prod.tfplan` | 2026-06-20T21:10:00Z | low for live launch |
| Plan/path ledger repair | pass, 332 owned paths across 14 plan files including backend, iOS, and Android integration fail-closed files | `prompts/outputs/current/path-ledger.md` | `PATH="/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" bash .ai-prompts/scripts/validate-ready-to-execute.sh prompts/outputs/current` | 2026-06-20T23:20:59Z | high |
| Historical root-guide archive | pass, repository root is limited to the approved docs allowlist and 63 historical files are under `docs/archive/2026/` with provenance | `docs/archive/2026/` | `python3 scripts/docs/apply_disposition.py --inventory docs/governance/document-inventory.csv --dry-run && find . -maxdepth 1 -type f \\( -name '*.md' -o -name '*.txt' \\)` | 2026-06-20T22:57:41Z | high |
| Disabled-capability current-doc/store/release-copy sweep | pass, verifier now covers inventory-current Markdown/TXT docs plus store/release planning copy | `scripts/docs/verify_disabled_capability_claims.py` | `python3 scripts/docs/verify_disabled_capability_claims.py --root . && python3 scripts/docs/check_all.py && python3 scripts/docs/check_all.py --fixtures scripts/docs/fixtures` | 2026-06-20T22:57:41Z | high |
| Web admin portal local integration | pass, non-operators do not see the sidebar link and are redirected from `/admin`; operator users load fake admin API evidence for analytics/users/moderation/tickets/flags | `frontend/src/pages/AdminPortalPage.tsx` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json && PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" CI=1 npm run test:e2e --workspace=frontend -- --project=chromium auth.spec.ts` | 2026-06-20T23:15:04Z | high |
| Disabled delivery/POS integration fail-closed cleanup | pass, backend delivery partners no longer fabricate provider success, the capability registry has no stale delivery stub marker, and iOS/Android POS-delivery connect paths return launch-gated state instead of hitting disabled endpoints | `backend/src/services/DeliveryService.ts` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" node node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json && DEVELOPER_DIR=/Applications/Xcode-27.0.0-Beta.app/Contents/Developer swiftc -parse ios/MenuMaker/Data/Repositories/IntegrationRepository.swift ios/MenuMaker/ViewModels/IntegrationViewModel.swift ios/MenuMaker/Data/Models/ReferralModels.swift ios/MenuMaker/Shared/Constants/AppConstants.swift ios/MenuMaker/Core/Services/APIClient.swift ios/MenuMaker/Core/Services/AnalyticsService.swift && cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:compileCustomerDebugKotlin :app:compileSellerDebugKotlin && cd .. && python3 scripts/quality/verify_capability_registry.py && bash scripts/quality/find-runtime-stubs.sh` | 2026-06-20T23:20:59Z | high |
| Objective completion audit for requested scope | pass, local evidence covers admin portal route, disabled-capability launch-surface cleanup, Android sample/preference closures, iOS profile upload, media ownership, and web error monitoring | `prompts/outputs/current/execution-log.md` | `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json && PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" CI=1 npm run test:e2e --workspace=frontend -- --project=chromium && python3 scripts/docs/check_all.py && bash scripts/cleanup/verify-android-screen-ownership.sh && bash scripts/quality/find-runtime-stubs.sh` | 2026-06-20T23:23:18Z | high |
| Backend media ownership typecheck | pass | `backend/src/services/MediaService.ts` | `node node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json` | 2026-06-20T21:45:00Z | high |
| iOS profile media parse check | pass, command-line Swift parse only | `ios/MenuMaker/Views/Customer/ProfileView.swift` | `swiftc -parse ios/MenuMaker/ViewModels/ProfileViewModel.swift ios/MenuMaker/Views/Customer/ProfileView.swift ios/MenuMaker/Core/Services/ImageService.swift ios/MenuMaker/Shared/Constants/AppConstants.swift` | 2026-06-20T21:45:00Z | medium |

## Functional and use-case completeness ledger

| Area | Launch-scope state | What is still left |
|---|---|---|
| Customer web ordering | Primary browse → cart → checkout → confirmation flow has Chromium E2E evidence. | Re-run against a real deployed backend before launch; fake-backend coverage is not live-system proof. |
| Seller web portal | Business setup, menu management, and seller order management have Chromium E2E evidence. | Validate release candidate against deployed API/database and payment/provider credentials. |
| Customer mobile | iOS customer payment/image smoke passes; Android customer compile and test APK build reach device-discovery; Android customer sample seller/dish/favorites/order fallbacks were replaced with loading/error/empty states. | Android connected-device execution is UNVERIFIED; rerun on an emulator/device with a JDK-equipped runner. |
| Seller mobile | Build gate compiles native stacks; iOS Business transport smoke passes. | Signed install/internal-track evidence is missing for both stores; Android connected seller/customer smoke needs an emulator/device; seller mobile release build should run against staging. |
| Admin / moderation / support | Backend admin, moderation, support-adjacent routes and tests exist; `frontend/src/App.tsx` exposes a first-party role-gated `/admin` route backed by admin API calls; Chromium E2E now proves non-operators are redirected while operator users render admin analytics, users, moderation, support tickets, and feature flags from the deterministic fake backend. | Admin-role authentication and operator journeys still need staging/live smoke evidence. |
| Payments | Stripe/payment boundary tests and credential-encryption tests are represented in the executor log and registry. | Live Stripe keys, live webhook endpoint, replay evidence, refund/receipt evidence, and removal or explicit non-production confinement of `/payments/mock-charge` are still required before public money movement. |
| Notifications | Notification outbox and WhatsApp capability evidence exists; Android notification preferences now persist through the settings API with optimistic rollback. | Provider credentials/templates, opt-out/consent verification, DLQ replay evidence, and backend notification-provider hooks still need release evidence or explicit waiver. |
| Media/profile uploads | Web and iOS media validation paths exist; iOS profile photo upload now uses `ImageService` plus `/auth/photo`, Android profile/review media flows upload through `MediaRepository` and the backend `/media/upload` contract, and backend media deletion checks storage owner metadata before removal. | Uploaded media scanner/evidence and live-object-storage smoke evidence are still release concerns. |
| Optional integrations | POS sync, delivery partner, OCR import, tax reporting, subscriptions, and enhanced referrals are out of launch scope in the capability registry; web/native launch UI and current README/store/release-copy surfaces now label those capabilities as disabled/launch-gated instead of available, backend delivery partner service paths fail closed instead of fabricating provider success, Android/iOS provider connect paths fail locally as launch-gated, and superseded root feature guides have been physically archived with provenance. | External store listings, screenshots, marketing copy outside this repository, and live provider credentials/certifications must be checked before enabling any disabled capability. |
| Localization | i18n capability is implemented with registry evidence. | Store listings, screenshots, and release-candidate locale QA are not evidenced yet. |

## Go-live blockers and required decisions

1. **Live production environment evidence is missing.** `infrastructure/environments/prod.tfvars` still contains example domains, placeholder account IDs, placeholder ACM ARNs, and offline planning. A real AWS account/region/domain/secrets setup plus protected deploy evidence is required.
2. **Deploy/rollback/restore has not run against a protected target.** The workflow is shaped for protected deploys, but no successful production/staging deploy artifact, rollback artifact, restore drill, or synthetic check result exists.
3. **Android connected testing is not evidenced.** `npm run test:android:fake` builds but fails with `No connected devices!`; launch needs emulator/device CI or a signed internal-track run.
4. **Store distribution evidence is missing.** `prompts/outputs/current/store-submission.md` requires TestFlight/Play internal testing, signing, app records, screenshots, privacy labels/Data Safety answers, review credentials, and support/privacy URLs.
5. **Admin portal live evidence is still missing.** A first-party role-gated `/admin` route now exists and has local fake-backend Chromium smoke evidence for non-operator redirect and operator access, but admin-role authentication and operator journeys still need staging/live smoke evidence.
6. **External disabled-capability collateral still needs release-channel verification.** In-repository launch UI, root/mobile README copy, current inventory docs, archived root feature guides, and current store/release planning copy are scrubbed/gated or historical for POS, delivery, OCR, tax reporting, subscriptions, and enhanced referrals; external store listings, screenshots, marketing copy, and any non-repository launch collateral still need review before release.
7. **Remaining release exceptions need explicit owner approval.** Android connected-device execution, uploaded-media scanning evidence, and backend notification-provider hook evidence need either completion in a provisioned runner or release waiver.
8. **External provider accounts and secrets are not provisioned.** AWS, Stripe live mode, Apple Developer/App Store Connect, Google Play/Firebase, Twilio, and optional OCR/POS/delivery providers need real account IDs, restricted credentials, and protected environment wiring.

## Capability summary

Capability state is governed by [capability-registry.yaml](capability-registry.yaml), not by historical root guides. Launch-scope capabilities marked `implemented` have local test evidence and named consumers. Disabled capabilities must fail closed and remain outside launch claims until their registry rows, provider credentials, privacy review, and smoke tests are updated.

## Environment limitations

- Connected Android instrumentation remains UNVERIFIED in this environment because no emulator/device was attached.
- Auto-commit is blocked by a broad pre-existing dirty worktree and unauthorized deletes from the library update; see `.ai-prompts/safety-report.json`.
- Production deployment and restore evidence for a live cloud environment remains UNVERIFIED until a protected deployment target is available.
- Current local web/iOS evidence uses fake-backend smoke coverage, which is useful regression evidence but not live-system readiness evidence.

## Next milestones

1. Provision real staging/prod infrastructure inputs and protected secrets, then run a staging deploy with rollback and restore evidence.
2. Stand up Android emulator/device CI and rerun seller/customer connected tests against the fake backend and staging backend.
3. Run admin portal and disabled-capability UI smoke tests against staging with admin/support/moderator accounts.
4. Close or explicitly waive the remaining release exceptions listed above.
5. Create Apple/Google app records, signing assets, privacy/Data Safety declarations, internal testing tracks, screenshots, review credentials, and support/privacy URLs.
6. Run a final release-candidate matrix: backend migrations, contract checks, web E2E against staging, iOS/Android signed app smoke, payment live-mode rehearsal, SLO/alert canaries, deploy rollback, and restore drill.
