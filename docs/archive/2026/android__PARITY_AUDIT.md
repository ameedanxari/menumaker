---
archived_at: 2026-06-20T22:55:01Z
original_path: android/PARITY_AUDIT.md
original_sha256: 4c2741a41a7fdf5be55f301c5bbb28731b5175e591ad9abf7fc6e380f222c978
superseded_by: docs/product/status.md
retention_reason: superseded root/platform guide; replacement identified
---

> Superseded by [docs/product/status.md](../../docs/product/status.md).

# Android Feature Parity Audit

_Audited: 2026-05-28_

## Route Mapping
| Web Route | Android Screen | Status |
| :--- | :--- | :--- |
| /login | LoginScreen | OK |
| /menu | MenuListScreen | Missing |
| /business/profile | BusinessProfileScreen | OK |
| /cart | CartScreen | Missing |

## UI Consistency
- Colors: Need sync with `frontend/src/design-tokens.json` (Material 3 mapping).
- Typography: Needs audit.
