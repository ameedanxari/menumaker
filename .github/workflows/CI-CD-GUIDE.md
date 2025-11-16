# CI/CD Pipeline Guide

## 🎯 Overview

MenuMaker uses a **smart, path-based CI/CD pipeline** that only runs tests and builds for the parts of the monorepo that changed. This dramatically reduces build times and costs.

### Key Features

✅ **PR-Only Triggers** - Pipelines only run on Pull Requests, not on every commit
✅ **Path-Based Detection** - Only affected components are tested
✅ **Multi-Platform Support** - Backend, Frontend, Android, and iOS
✅ **Parallel Execution** - Independent jobs run in parallel
✅ **Comprehensive Checks** - Lint, test, build, and typecheck for each platform

---

## 🚀 Main Workflow: `smart-ci.yml`

The primary CI/CD workflow that runs on all pull requests.

### Trigger Conditions

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main
```

**Only runs on:**
- New PRs to `main`
- New commits pushed to existing PRs
- PRs that are reopened

**Does NOT run on:**
- Direct pushes to branches
- Draft PRs (unless marked ready for review)

---

## 📁 Change Detection

The pipeline automatically detects which parts of the monorepo changed:

| Path Pattern | Component | Jobs Triggered |
|--------------|-----------|----------------|
| `backend/**` | Backend | Lint, Test, Build, TypeCheck |
| `frontend/**` | Frontend | Lint, Test, Build, TypeCheck |
| `android/**` | Android | Lint, Test, Build APK |
| `ios/**` | iOS | Lint, Build, Test |
| `shared/**` | All | All components |

### Example Scenarios

#### Scenario 1: Only Backend Changes
```
Changes: backend/src/services/auth.ts
Runs: Backend jobs only (lint, test, build, typecheck)
Skips: Frontend, Android, iOS jobs
```

#### Scenario 2: Frontend + Android Changes
```
Changes:
  - frontend/src/App.tsx
  - android/app/src/main/kotlin/MainActivity.kt
Runs: Frontend + Android jobs
Skips: Backend, iOS jobs
```

#### Scenario 3: Shared Code Changes
```
Changes: shared/types/index.ts
Runs: All jobs (Backend, Frontend, Android, iOS)
```

---

## 🔧 Pipeline Jobs

### Backend Jobs

**1. backend-lint**
- Runs ESLint on TypeScript/JavaScript code
- Enforces code style and best practices

**2. backend-test**
- Runs Jest unit tests with PostgreSQL database
- Generates code coverage report
- Coverage uploaded as artifact

**3. backend-build**
- Compiles TypeScript to JavaScript
- Verifies build succeeds
- Uploads dist/ artifacts

**4. backend-typecheck**
- Runs TypeScript compiler in check mode
- Verifies type safety

### Frontend Jobs

**1. frontend-lint**
- Runs ESLint on React/TypeScript code
- Checks for accessibility issues

**2. frontend-test**
- Runs Vitest unit tests (if configured)
- Optional coverage generation

**3. frontend-build**
- Builds production bundle with Vite
- Uploads dist/ artifacts for review

**4. frontend-typecheck**
- Verifies TypeScript types
- Checks for type errors

### Android Jobs

**1. android-lint**
- Runs Android Lint on Kotlin code
- Checks for code quality issues
- Uploads lint reports

**2. android-test**
- Runs JUnit unit tests
- Uploads test results
- Verifies ViewModels and repositories

**3. android-build**
- Builds debug APK with Gradle
- Verifies compilation succeeds
- Uploads APK artifact (downloadable)

### iOS Jobs

**1. ios-lint**
- Runs SwiftLint on Swift code
- Enforces Swift style guidelines

**2. ios-build**
- Verifies Swift syntax with swiftc
- Validates project structure
- Prepares for Xcode project creation

**3. ios-test**
- Validates test infrastructure
- Ready for XCTest execution

---

## 📊 Pipeline Outputs

### Artifacts

The pipeline uploads build artifacts for review:

| Artifact Name | Description | Retention |
|---------------|-------------|-----------|
| `backend-coverage` | Test coverage reports | 7 days |
| `backend-dist` | Compiled backend code | 7 days |
| `frontend-dist` | Built frontend bundle | 7 days |
| `android-debug-apk` | Debug APK for testing | 7 days |
| `android-lint-results` | Android lint HTML reports | 7 days |
| `android-test-results` | JUnit test results | 7 days |

### PR Comments

The pipeline automatically comments on PRs with:
- ✅ Which components changed
- ✅ Test results for each component
- ✅ Build status summary
- ✅ Links to artifacts

---

## ⚡ Performance Optimizations

### 1. Conditional Execution
Only affected jobs run, saving time and compute resources.

**Example:**
- Full pipeline (all changes): ~30 minutes
- Backend only: ~8 minutes
- Frontend only: ~6 minutes
- Android only: ~10 minutes
- iOS only: ~5 minutes

### 2. Parallel Execution
Independent jobs run in parallel:
```
Backend (lint + test + build)  ──┐
Frontend (lint + test + build) ──┤─── ci-success
Android (lint + test + build)  ──┤
iOS (lint + build)             ──┘
```

### 3. Caching
- **NPM**: Dependencies cached per workflow
- **Gradle**: Android build cache
- **Swift**: Xcode build cache (when Xcode project exists)

---

## 🔐 Required Secrets

None currently required for CI. Future additions:

- `FIREBASE_SERVICE_ACCOUNT` - For Firebase integration tests
- `APPLE_CERTIFICATE` - For iOS code signing (release builds)
- `ANDROID_KEYSTORE` - For Android release builds

---

## 🐛 Troubleshooting

### Pipeline Failed on PR

**Check which jobs failed:**
1. Go to the PR's "Checks" tab
2. Click on "Smart CI/CD Pipeline"
3. Expand failed jobs to see error logs

**Common issues:**

#### Backend Tests Failing
```bash
# Run tests locally
cd backend
npm test
```

#### Frontend Build Failing
```bash
# Check build locally
cd frontend
npm run build
```

#### Android Build Failing
```bash
# Run Gradle build locally
cd android
./gradlew assembleDebug
```

#### iOS Lint Failing
```bash
# Run SwiftLint locally
cd ios
swiftlint lint
```

### No Jobs Running

If the pipeline shows "No changes detected":
- Check that your changes are in `backend/`, `frontend/`, `android/`, or `ios/`
- Changes to docs or root config won't trigger component builds

### Manual Workflow Trigger

To manually run a workflow (e.g., for testing):

1. Go to Actions tab
2. Select workflow (e.g., "Android CI (Legacy)")
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow" button

---

## 📚 Workflow Files

| File | Purpose | Trigger |
|------|---------|---------|
| `smart-ci.yml` | **Main CI/CD** - Smart path-based pipeline | PRs to main |
| `pr-checks.yml` | PR validation, bundle size, coverage | PRs |
| `nightly-e2e.yml` | End-to-end tests | Nightly schedule |
| `deploy.yml` | Production deployment | Manual/tags |
| `ci.yml` (legacy) | Old CI pipeline | Manual only |
| `android-ci.yml` (legacy) | Old Android CI | Manual only |

---

## 🎯 Best Practices

### For Contributors

1. **Create focused PRs**
   - Change one component at a time when possible
   - Reduces CI time and makes reviews easier

2. **Run tests locally first**
   ```bash
   # Backend
   cd backend && npm test

   # Frontend
   cd frontend && npm test

   # Android
   cd android && ./gradlew test
   ```

3. **Check lint before pushing**
   ```bash
   # Backend
   cd backend && npm run lint

   # Frontend
   cd frontend && npm run lint

   # Android
   cd android && ./gradlew lint
   ```

4. **Keep PRs small**
   - Faster CI execution
   - Easier code review
   - Lower failure risk

### For Reviewers

1. **Check CI status before review**
   - Don't review until CI passes
   - Download artifacts to test changes

2. **Review coverage reports**
   - Backend coverage should be >70%
   - Check that new code has tests

3. **Check bundle size**
   - Frontend bundle shouldn't grow significantly
   - Review bundle-size job output

---

## 🚢 Deployment Pipeline

Production deployments use a separate workflow (`deploy.yml`):

**Triggers:**
- Manual workflow dispatch
- Git tags (e.g., `v1.2.3`)

**Process:**
1. Run full test suite
2. Build production artifacts
3. Deploy to staging
4. Run smoke tests
5. Deploy to production
6. Tag release

**Environments:**
- `staging` - Auto-deployed from `main`
- `production` - Manual promotion from staging

---

## 📈 Metrics & Monitoring

### Success Metrics

Track these metrics to ensure pipeline health:

- ✅ **CI Success Rate**: >95% (target)
- ✅ **Average Duration**: <10 min per component
- ✅ **Artifact Size**: <50MB per build
- ✅ **Test Coverage**: >70% backend

### Monitoring

GitHub Actions provides:
- Workflow run history
- Success/failure trends
- Duration analytics
- Artifact storage usage

**Access:**
Repository → Insights → Actions

---

## 🔄 Future Improvements

Planned enhancements:

- [ ] E2E tests for mobile apps (Detox for React Native equivalent)
- [ ] Automated screenshot testing (Percy/Chromatic)
- [ ] Performance regression testing
- [ ] Automated dependency updates (Dependabot)
- [ ] Advanced caching strategies
- [ ] Matrix builds for multiple Android/iOS versions

---

## 📞 Support

For CI/CD issues:

1. Check this guide first
2. Review workflow logs in PR checks
3. Open an issue with:
   - PR link
   - Failed job name
   - Error logs
   - Steps to reproduce

---

**Last Updated**: 2025-11-16
**Maintained By**: DevOps Team
**Version**: 2.0 (Smart Path-Based CI/CD)
