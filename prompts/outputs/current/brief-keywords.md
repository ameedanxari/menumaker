# Baseline Scope Decisions

| Keyword / phrase | Status | Covered by / reason |
|---|---|---|
| App Store Release Prep | out-of-scope | Store-submission sequencing is recorded in `store-submission.md`; executable listing, capture, signing, and metadata work begins only after the audited Tier 0 product and delivery blockers close. |
| Localization & RTL | out-of-scope | This remediation preserves existing locale resources and RTL behavior but does not introduce or expand an i18n framework, supported locale list, or translation program. |
| Account identity | out-of-scope | New sign-up, sign-in, and password-reset product work was not identified as a gap; G2 is narrowly scoped to refresh-session and payment-boundary security. |
| Admin & RBAC | out-of-scope | A new admin user/role management surface and role-transition program were not identified as gaps in this pass; existing protected endpoints remain subject to security tests. |
