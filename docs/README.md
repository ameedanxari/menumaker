---
Status: current
Owner: maintainers
Review cadence: monthly
Last reviewed: 2026-06-20
---

# MenuMaker documentation

This directory is the current documentation authority for MenuMaker. Root-level reports and phase guides are historical unless they are one of the approved root files (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `MY_PROJECT.md`) or are explicitly marked current in the [document inventory](governance/document-inventory.csv).

## Start here

- Current product and release posture: [product/status.md](product/status.md)
- Capability ownership and implementation state: [product/capability-index.md](product/capability-index.md)
- Machine-readable capability registry: [product/capability-registry.yaml](product/capability-registry.yaml)
- Target architecture: [architecture/target-state.md](architecture/target-state.md)
- API contract authority ADR: [architecture/adr/0003-api-contract-authority.md](architecture/adr/0003-api-contract-authority.md)
- Versioned OpenAPI contract: [../openapi/menumaker.v1.yaml](../openapi/menumaker.v1.yaml)
- Developer setup script: [../scripts/dev-setup.sh](../scripts/dev-setup.sh)
- Required CI workflow: [../.github/workflows/smart-ci.yml](../.github/workflows/smart-ci.yml)
- Incident and operational runbooks: [operations/runbooks/index.md](operations/runbooks/index.md)
- Security threat model: [security/threat-model.md](security/threat-model.md)
- Data inventory and privacy handling: [security/data-inventory.yaml](security/data-inventory.yaml)
- Mobile release data-practices manifest: [release/mobile-data-practices.yaml](release/mobile-data-practices.yaml)
- Design-system state matrix: [design-system/state-matrix.yaml](design-system/state-matrix.yaml)
- Historical archive landing page: [archive/2026/](archive/2026/)

## Authority precedence

1. Machine-readable contracts and ledgers: OpenAPI, capability registry, data inventory, SLO catalog, migration files, CI workflow gates.
2. Architecture decisions and target-state documents under `docs/architecture/`.
3. Product/status and capability pages under `docs/product/`.
4. Runbooks, release manifests, and security/privacy evidence under their owned folders.
5. Archived root/spec/platform reports, which are provenance only and must point to a current replacement.

Generated outputs, coverage summaries, and old phase completion reports are not current truth. Link to them as evidence only through the inventory or archive metadata.

## Ownership and lifecycle

- Product docs: product/platform owner, reviewed monthly.
- Architecture docs and ADRs: architecture owner, reviewed quarterly or before a related implementation task.
- Development/testing docs: engineering owner, reviewed when build/test gates change.
- Operations/runbooks: ops owner, reviewed after incidents, drills, or SLO changes.
- Security/release docs: security/release owner, reviewed before every release candidate.
- Archive docs: read-only historical evidence; freshness checks do not apply, but provenance metadata is required.

Documentation checks live in `scripts/docs/` and are run with:

```bash
python3 scripts/docs/check_all.py
```
