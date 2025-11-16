# GitHub Actions Workflows

## 🎯 Quick Reference

| Workflow | Purpose | Trigger | Status |
|----------|---------|---------|--------|
| **smart-ci.yml** | **Main CI/CD Pipeline** | PRs to `main` | ✅ Active |
| pr-checks.yml | PR validation, bundle analysis | PRs | ✅ Active |
| nightly-e2e.yml | End-to-end tests | Nightly schedule | ✅ Active |
| deploy.yml | Production deployment | Manual/Tags | ✅ Active |
| ci.yml | Legacy CI pipeline | Manual only | ⚠️ Legacy |
| android-ci.yml | Legacy Android CI | Manual only | ⚠️ Legacy |

---

## 🚀 Main Pipeline: smart-ci.yml

**The intelligent, path-based CI/CD pipeline for all PRs.**

### Features

✅ **Smart Change Detection** - Only runs tests/builds for changed components
✅ **Multi-Platform Support** - Backend, Frontend, Android, iOS
✅ **Comprehensive Checks** - Linting, Testing, Building, Type checking

### When It Runs

Only on Pull Requests to `main` - No excessive builds on every commit!

For complete documentation, see [CI-CD-GUIDE.md](./CI-CD-GUIDE.md)
