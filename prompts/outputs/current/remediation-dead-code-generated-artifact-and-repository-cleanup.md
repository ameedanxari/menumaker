# Remediation Prompt — Dead Code, Generated Artifact, and Repository Cleanup

_Closes gap:_ G14 · dead-code-generated-artifact-and-repository-cleanup

## Context

The audit found duplicate Android Cart/Menu screens, duplicate web Buttons/token copies, hard-coded runtime samples, a monolithic iOS mock router, tracked backend coverage/test text output, a test Firebase config in production path, obsolete in-source checklists, compatibility aliases, and five overlapping workflows. Some are demonstrably suspicious but deletion must be reference- and behavior-proven rather than based on filename intuition.

## What to build

Create an evidence-backed cleanup ledger and automated scanners, migrate references to canonical owners, delete only confirmed dead/generated/test-only artifacts, enforce test/production source separation and repository allowlists, and retain a reversible manifest for every cleanup batch.

Where cleanup touches UI components or screens, existing product style is authoritative; prove default, loading, empty, error, disabled, and success states remain covered before deletion.

## Implementation guidance

## R1 · Generate the dead-code and artifact ledger
- **Closes user story:** As a maintainer, I need cleanup candidates backed by references and ownership, so that deletion removes debt without breaking hidden flows.
- **Change type:** create-new
- **File:** `docs/engineering/cleanup-ledger.yaml`
- **File:** `scripts/cleanup/verify_ledger.py`
- **Precise change:** Record candidate path/symbol, category (`duplicate`, `unreferenced`, `generated`, `fixture-in-production`, `compatibility`, `stale-report`, `legacy-workflow`), evidence commands/results, runtime/build/test/resource references, owner, canonical replacement, migration tasks, risk, rollback, disposition, and approval.
- **Acceptance:**
  - Every candidate named in the audit has a row and hash; unknown/dynamic/reflection/resource references prevent automatic deletion.
  - A row cannot become `delete-approved` without replacement, zero-reference proof, behavior coverage, and rollback evidence.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `python3 scripts/cleanup/verify_ledger.py docs/engineering/cleanup-ledger.yaml` reports complete evidence and no duplicate ownership.
- **Estimated LOC:** +220
- **Phase:** polish

## R2 · Detect source, resource, generated, and fixture ownership
- **Closes user story:** As a developer, I need repository-aware dead-code analysis, so that dynamic mobile resources and generated files are not misclassified by a simple text search.
- **Change type:** create-new
- **File:** `scripts/cleanup/discover_candidates.py`
- **File:** `scripts/cleanup/fixtures/expected-candidates.yaml`
- **File:** `scripts/cleanup/fixtures/sample-web/src/unused.ts`
- **File:** `scripts/cleanup/fixtures/sample-web/src/used.ts`
- **File:** `scripts/cleanup/fixtures/sample-web/src/index.ts`
- **File:** `scripts/cleanup/fixtures/sample-android/res/navigation/nav_graph.xml`
- **File:** `scripts/cleanup/fixtures/sample-android/src/main/kotlin/com/example/DynamicScreen.kt`
- **File:** `scripts/cleanup/fixtures/sample-ios/project.pbxproj`
- **Precise change:** Combine TypeScript import dependency maps/tsconfig, Kotlin compiler/source-set/navigation/Hilt/Room/resource references, Xcode target membership/symbol/resource lookups, workflow calls, package scripts, git tracking/ignore rules, and generated headers; output evidence into the ledger without deleting.
- **Acceptance:**
  - Fixtures prove detection of unused imports/files, duplicate symbols, Xcode target-only references, Android resource/navigation references, generated outputs, and dynamic-reference uncertainty.
  - The tool never labels uncertain/reflection/string/resource candidates auto-delete.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (ledger schema)
- **Test:** `python3 scripts/cleanup/discover_candidates.py --fixtures scripts/cleanup/fixtures --check` matches the expected candidate classifications.
- **Estimated LOC:** +420
- **Phase:** polish

## R3 · Separate production code from fixtures and generated reports
- **Closes user story:** As a release engineer, I need test/generated artifacts excluded from production and version control, so that packages contain only intentional runtime assets.
- **Change type:** modify-existing
- **File:** `.gitignore`
- **File:** `backend/coverage_output.txt`
- **File:** `backend/final_coverage.txt`
- **File:** `backend/test_output.txt`
- **File:** `android/app/google-services.json`
- **File:** `android/app/google-services.json.README`
- **Precise change:** Ignore coverage/test output, Playwright reports, Gradle/Xcode derived artifacts, local Firebase configs, generated API clients where regeneration policy requires, Terraform plan/state, and evidence temp files; untrack `backend/coverage_output.txt`, `backend/final_coverage.txt`, `backend/test_output.txt`; replace `android/app/google-services.json` with documented local/CI injection and safe template.
- **Acceptance:**
  - A clean build/test leaves no untracked repository noise except declared evidence directories.
  - Release artifact scans contain no test fixtures, UI mock routers, test Firebase project values, coverage output, Terraform state, or local credentials.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (artifact ownership evidence)
- **Test:** `bash scripts/cleanup/verify-repository-hygiene.sh` exits 0 after web/backend/Android/iOS test artifact fixtures are generated.
- **Estimated LOC:** +80
- **Phase:** polish

## R4 · Remove confirmed duplicate UI and test implementations
- **Closes user story:** As a UI maintainer, I need one implementation per component/screen, so that fixes and accessibility behavior cannot diverge in dead copies.
- **Change type:** create-new
- **File:** `scripts/cleanup/apply-source-cleanup.py`
- **Precise change:** Consume delete-approved ledger rows, migrate web `components/common/Button` consumers to `components/ui/Button`, remove duplicate Android Cart/Menu screens after G5 verification, remove duplicate token JSON after G12 generation, move iOS fixtures out of production membership after G6, and emit exact moved/deleted hashes plus reverse patch.
- **Acceptance:**
  - TypeScript, both Android flavors, both iOS schemes, navigation tests, UI component tests, and accessibility checks pass after each small cleanup batch.
  - The script defaults to dry-run, refuses dirty overlapping files, and applies only approved hashes to prevent deleting changed code.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-android-real-data-and-primary-flow-completion.md (Android ownership), remediation-ios-target-transport-and-primary-flow-consolidation.md (iOS mock removal), remediation-design-system-and-ui-state-consolidation.md (web primitive authority), R3 (source separation)
- **Test:** `python3 scripts/cleanup/apply-source-cleanup.py --ledger docs/engineering/cleanup-ledger.yaml --dry-run --verify` exits 0.
- **Estimated LOC:** +300
- **Phase:** polish

## R5 · Retire legacy workflows and compatibility code safely
- **Closes user story:** As a CI maintainer, I need one active release pipeline and finite deprecations, so that stale automation and aliases do not keep influencing builds.
- **Change type:** create-new
- **File:** `docs/engineering/workflow-ownership.yaml`
- **File:** `scripts/ci/verify_workflow_ownership.py`
- **Precise change:** Map triggers/jobs/required checks/artifacts from `ci.yml`, `pr-checks.yml`, `nightly-e2e.yml`, `smart-ci.yml`, and `deploy.yml`; designate consolidated active workflows, migrate unique jobs, disable/rename legacy triggers, then delete legacy files after one green observation window; link G9 deprecation entries for route/model aliases.
- **Acceptance:**
  - Every required check/job has exactly one owner and no duplicate workflow races or contradictory environment setup.
  - If workflow ownership is rendered as a graph, loading and empty states explain unavailable workflow data, error states name the invalid workflow/check, the legend distinguishes active/legacy/retired workflows, and each tooltip shows trigger, owner, required-check, and artifact metadata.
  - Deleted aliases/workflows have zero code/repository-setting references and a documented rollback commit.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-executable-fail-closed-delivery-pipeline.md (active deployment), remediation-bounded-context-and-code-ownership-consolidation.md (deprecation ledger)
- **Test:** `python3 scripts/ci/verify_workflow_ownership.py docs/engineering/workflow-ownership.yaml .github/workflows` reports unique ownership and valid triggers.
- **Estimated LOC:** +160
- **Phase:** polish

## R6 · Enforce repository hygiene continuously
- **Closes user story:** As a contributor, I need cleanup regressions caught automatically, so that generated output, duplicate owners, runtime samples, and stale reports do not accumulate again.
- **Change type:** create-new
- **File:** `scripts/cleanup/verify-repository-hygiene.sh`
- **File:** `scripts/cleanup/fixtures/hygiene/bad-coverage-output/backend/coverage_output.txt`
- **File:** `scripts/cleanup/fixtures/hygiene/bad-firebase-config/android/app/google-services.json`
- **File:** `scripts/cleanup/fixtures/hygiene/bad-root-doc/UNOWNED.md`
- **File:** `scripts/cleanup/fixtures/hygiene/bad-sample-marker/frontend/src/sampleData.ts`
- **File:** `scripts/cleanup/fixtures/hygiene/good/.gitkeep`
- **Precise change:** Fail on tracked build/coverage/test/state/credential artifacts, unauthorized root docs, production mock/sample markers, duplicate component/screen authorities, expired deprecations/cleanup rows, broken generated-file policy, and unexpected large files; support a narrow owner/expiry allowlist and emit remediation links.
- **Acceptance:**
  - Seeded fixtures for each prohibited category fail with a precise path/category/owner action.
  - The gate runs in required CI and a clean checkout/build/test cycle passes without manual deletion.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (source cleanup), R5 (workflow cleanup), remediation-documentation-information-architecture-and-truth.md (documentation cleanup)
- **Test:** `shellcheck scripts/cleanup/verify-repository-hygiene.sh && bash scripts/cleanup/verify-repository-hygiene.sh --fixtures scripts/cleanup/fixtures` exits 0 for expected outcomes.
- **Estimated LOC:** +240
- **Phase:** polish

## What NOT to do

- Do not delete by filename, zero text references, or age alone; mobile resources, target memberships, scripts, and dynamic lookups count.
- Do not mix sweeping cleanup with behavior changes in one batch.
- Do not commit generated/runtime output merely because a test report is useful; publish it as CI evidence and link it from current docs.
