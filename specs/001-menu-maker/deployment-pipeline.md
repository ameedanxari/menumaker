# Deployment Pipeline & CI/CD Specification

**Date**: 2025-11-14
**Status**: ✅ Ready for Implementation
**Target Platform**: GitHub Actions → Heroku/Render

---

## Overview

MenuMaker uses GitHub Actions for continuous integration and continuous deployment (CI/CD). The pipeline automatically tests, builds, and deploys code changes across three environments: local development, staging, and production.

---

## Deployment Environments

| Environment | URL | Database | Purpose | Deploy Trigger |
|-------------|-----|----------|---------|----------------|
| **Local** | localhost:3000 | PostgreSQL (Docker Compose) | Development | Manual (`npm run dev`) |
| **Staging** | staging.menumaker.app | Heroku Postgres (Basic tier) | Pre-production testing | Auto (merge to `main`) |
| **Production** | menumaker.app | Heroku Postgres (Standard tier) | Live users | Manual approval |
| **Admin Staging** | admin-staging.menumaker.app | Shared with Staging | Admin portal testing | Auto (merge to `main`) |
| **Admin Production** | admin.menumaker.app | Shared with Production | Admin portal live | Manual approval |

### Environment Variables

See `environment-variables-spec.md` for complete list. Key differences:

```bash
# Local (.env.local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/menumaker_dev
S3_ENDPOINT=http://localhost:9000  # MinIO
NODE_ENV=development
LOG_LEVEL=debug

# Staging (.env.staging - Heroku Config Vars)
DATABASE_URL=<heroku-managed>
S3_ENDPOINT=<s3.amazonaws.com>
NODE_ENV=staging
LOG_LEVEL=info

# Production (.env.production)
DATABASE_URL=<heroku-managed>
S3_ENDPOINT=<s3.amazonaws.com>
NODE_ENV=production
LOG_LEVEL=warn
```

---

## GitHub Actions Workflows

### File Structure

```
.github/
└── workflows/
    ├── pr-checks.yml          # Run on pull requests
    ├── deploy-staging.yml     # Auto-deploy to staging
    ├── deploy-production.yml  # Manual deploy to production
    └── nightly-tests.yml      # Nightly regression tests
```

---

## Workflow 1: Pull Request Checks

**File**: `.github/workflows/pr-checks.yml`

**Triggers**:
- On pull request opened/updated to `main` branch
- On push to any branch (optional)

**Jobs**:

### Job 1: Lint & Type Check (2-3 min)

```yaml
lint-and-type-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    # Backend
    - name: Install backend dependencies
      run: cd backend && npm ci

    - name: Lint backend
      run: cd backend && npm run lint

    - name: TypeScript check backend
      run: cd backend && npm run type-check

    # Frontend
    - name: Install frontend dependencies
      run: cd frontend && npm ci

    - name: Lint frontend
      run: cd frontend && npm run lint

    - name: TypeScript check frontend
      run: cd frontend && npm run type-check
```

### Job 2: Unit Tests (3-5 min)

```yaml
unit-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: menumaker_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install backend dependencies
      run: cd backend && npm ci

    - name: Run database migrations
      run: cd backend && npm run migrate:test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/menumaker_test

    - name: Run unit tests with coverage
      run: cd backend && npm run test:coverage
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/menumaker_test

    - name: Check coverage threshold (>70%)
      run: cd backend && npm run test:coverage -- --coverageThreshold='{"global":{"statements":70,"branches":70,"functions":70,"lines":70}}'

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v4
      with:
        files: ./backend/coverage/lcov.info
        flags: backend
```

### Job 3: Contract Tests (2-3 min)

```yaml
contract-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      # ... same as unit-tests

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4

    - name: Install dependencies
      run: cd backend && npm ci

    - name: Run migrations
      run: cd backend && npm run migrate:test

    - name: Run contract tests (OpenAPI validation)
      run: cd backend && npm run test:contract
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/menumaker_test
```

### Job 4: Frontend Build (2-3 min)

```yaml
frontend-build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4

    - name: Install frontend dependencies
      run: cd frontend && npm ci

    - name: Build frontend
      run: cd frontend && npm run build

    - name: Check bundle size
      run: cd frontend && npm run analyze-bundle
```

**PR Status Check**: All 4 jobs must pass before merge is allowed.

---

## Workflow 2: Deploy to Staging

**File**: `.github/workflows/deploy-staging.yml`

**Triggers**:
- Automatic on merge to `main` branch
- Manual trigger (`workflow_dispatch`)

**Jobs**:

### Job 1: Deploy Backend to Staging

```yaml
deploy-backend-staging:
  runs-on: ubuntu-latest
  environment: staging
  steps:
    - uses: actions/checkout@v4

    - name: Install Heroku CLI
      run: curl https://cli-assets.heroku.com/install.sh | sh

    - name: Heroku login
      run: echo "${{ secrets.HEROKU_API_KEY }}" | heroku auth:token

    - name: Deploy backend to Heroku staging
      run: |
        cd backend
        git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/menumaker-api-staging.git HEAD:main --force

    - name: Run database migrations
      run: heroku run npm run migrate -- menumaker-api-staging

    - name: Restart dynos
      run: heroku ps:restart -a menumaker-api-staging
```

### Job 2: Deploy Frontend to Staging

```yaml
deploy-frontend-staging:
  runs-on: ubuntu-latest
  environment: staging
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4

    - name: Install frontend dependencies
      run: cd frontend && npm ci

    - name: Build frontend for staging
      run: cd frontend && npm run build
      env:
        VITE_API_URL: https://api-staging.menumaker.app
        VITE_ENV: staging

    - name: Deploy to Vercel Staging
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        working-directory: ./frontend
        scope: menumaker
```

### Job 3: Smoke Tests (Staging)

```yaml
smoke-tests-staging:
  runs-on: ubuntu-latest
  needs: [deploy-backend-staging, deploy-frontend-staging]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4

    - name: Install dependencies
      run: cd frontend && npm ci

    - name: Run Playwright smoke tests
      run: cd frontend && npm run test:e2e:smoke
      env:
        BASE_URL: https://staging.menumaker.app
        API_URL: https://api-staging.menumaker.app

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: frontend/playwright-report/
```

**Slack Notification**:

```yaml
- name: Notify Slack on deployment
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Staging deployment successful: https://staging.menumaker.app",
        "channel": "#deployments"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Workflow 3: Deploy to Production

**File**: `.github/workflows/deploy-production.yml`

**Triggers**:
- **Manual only** (`workflow_dispatch`)
- Requires approval from team lead

**Pre-Deployment Checklist**:

```yaml
pre-deploy-checks:
  runs-on: ubuntu-latest
  steps:
    - name: Verify staging is green
      run: |
        curl -f https://staging.menumaker.app/health || exit 1

    - name: Check Sentry for critical errors
      run: |
        # Query Sentry API for P0/P1 errors in last 24h
        # Fail if critical errors present

    - name: Backup production database
      run: |
        heroku pg:backups:capture -a menumaker-api-production
        heroku pg:backups:download -a menumaker-api-production
```

**Deployment Jobs**:

### Job 1: Deploy Backend to Production

```yaml
deploy-backend-production:
  runs-on: ubuntu-latest
  environment: production
  needs: pre-deploy-checks
  steps:
    - uses: actions/checkout@v4

    - name: Deploy to Heroku production
      run: |
        cd backend
        git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/menumaker-api-production.git HEAD:main --force

    - name: Run database migrations
      run: heroku run npm run migrate -a menumaker-api-production

    - name: Scale dynos (if needed)
      run: heroku ps:scale web=2:standard-1x -a menumaker-api-production
```

### Job 2: Deploy Frontend to Production

```yaml
deploy-frontend-production:
  runs-on: ubuntu-latest
  environment: production
  needs: pre-deploy-checks
  steps:
    - uses: actions/checkout@v4

    - name: Build frontend for production
      run: cd frontend && npm ci && npm run build
      env:
        VITE_API_URL: https://api.menumaker.app
        VITE_ENV: production

    - name: Deploy to Vercel Production
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        vercel-args: '--prod'
```

### Job 3: Post-Deployment Validation

```yaml
post-deploy-validation:
  runs-on: ubuntu-latest
  needs: [deploy-backend-production, deploy-frontend-production]
  steps:
    - name: Health check
      run: curl -f https://menumaker.app/health || exit 1

    - name: API smoke test
      run: curl -f https://api.menumaker.app/v1/health || exit 1

    - name: Run critical E2E tests
      run: cd frontend && npm run test:e2e:critical
      env:
        BASE_URL: https://menumaker.app

    - name: Monitor error rates (5 min)
      run: |
        # Query Sentry API for error spike
        # Alert if error rate >5% above baseline
```

**Rollback on Failure**:

```yaml
rollback:
  runs-on: ubuntu-latest
  if: failure()
  needs: post-deploy-validation
  steps:
    - name: Rollback Heroku backend
      run: heroku releases:rollback -a menumaker-api-production

    - name: Rollback Vercel frontend
      run: vercel rollback --token ${{ secrets.VERCEL_TOKEN }}

    - name: Restore database from backup
      run: heroku pg:backups:restore -a menumaker-api-production

    - name: Alert team
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "🚨 Production deployment FAILED and ROLLED BACK. Check logs immediately.",
            "channel": "#incidents"
          }
```

---

## Rollback Procedures

### Automated Rollback (During Deployment)

If post-deployment validation fails:
1. **Backend**: `heroku releases:rollback -a menumaker-api-production`
2. **Frontend**: `vercel rollback --token $VERCEL_TOKEN`
3. **Database**: Restore from latest backup (created pre-deployment)

### Manual Rollback (Production Incident)

**Steps** (execute in order):

```bash
# 1. Identify last known good release
heroku releases -a menumaker-api-production | head -5

# 2. Rollback backend to specific release
heroku releases:rollback v123 -a menumaker-api-production

# 3. Rollback frontend (find deployment ID in Vercel dashboard)
vercel rollback <deployment-id> --token $VERCEL_TOKEN

# 4. Check if database migration rollback needed
heroku run npm run migrate:rollback -a menumaker-api-production

# 5. Verify health
curl https://menumaker.app/health
curl https://api.menumaker.app/v1/health

# 6. Monitor error rates in Sentry for 10 minutes
# If stable, incident resolved
# If errors persist, investigate further
```

**Database Rollback**:

```bash
# List available backups
heroku pg:backups -a menumaker-api-production

# Restore from specific backup (DESTRUCTIVE!)
heroku pg:backups:restore b001 DATABASE_URL -a menumaker-api-production --confirm menumaker-api-production
```

**Rollback Window**: Database rollbacks available for last 7 days (Heroku Postgres Standard tier)

---

## Deployment Checklist

### Pre-Deployment (Production)

- [ ] All staging smoke tests passing
- [ ] No critical errors in Sentry (last 24 hours)
- [ ] Database backup created successfully
- [ ] Team notified in #deployments Slack channel
- [ ] Deployment window confirmed (prefer off-peak hours: 10 PM - 6 AM IST)
- [ ] On-call engineer identified

### During Deployment

- [ ] Monitor GitHub Actions workflow progress
- [ ] Watch Heroku logs real-time (`heroku logs --tail -a menumaker-api-production`)
- [ ] Check Sentry for error spikes
- [ ] Verify database migrations completed successfully

### Post-Deployment

- [ ] Health checks passing (frontend + backend)
- [ ] Critical E2E tests passing
- [ ] Sentry error rate normal (<5% increase)
- [ ] API response times normal (p95 <200ms)
- [ ] Cloudflare CDN cache purged (if applicable)
- [ ] Update deployment log in Notion/Confluence
- [ ] Team notified of successful deployment

---

## Secrets Management

### GitHub Secrets (Repository Settings)

| Secret Name | Used For | Rotation Frequency |
|-------------|----------|-------------------|
| `HEROKU_API_KEY` | Heroku deployments | Every 90 days |
| `VERCEL_TOKEN` | Vercel deployments | Every 90 days |
| `VERCEL_ORG_ID` | Vercel org identifier | Never (static) |
| `VERCEL_PROJECT_ID` | Vercel project identifier | Never (static) |
| `SLACK_WEBHOOK_URL` | Deployment notifications | On leak/compromise |
| `CODECOV_TOKEN` | Code coverage uploads | Every 90 days |
| `SENTRY_AUTH_TOKEN` | Sentry API access | Every 90 days |

**Secret Rotation Procedure**:
1. Generate new secret in provider (Heroku/Vercel/Slack)
2. Update GitHub secret via Settings → Secrets → Actions
3. Test deployment in staging
4. Revoke old secret after 24 hours

---

## Monitoring & Alerts

### Deployment Monitoring

**Tools**:
- **Heroku Dashboard**: Dyno metrics, error rates
- **Vercel Dashboard**: Build logs, deployment status
- **Sentry**: Real-time error tracking
- **UptimeRobot**: Uptime monitoring (https://menumaker.app)

**Alerts** (Slack #deployments):
- Deployment started
- Deployment succeeded
- Deployment failed (with error logs)
- Rollback triggered

### Post-Deployment Monitoring (First 24 Hours)

Monitor these metrics:
- **Error Rate**: Should remain <1% (baseline)
- **API Latency**: p95 should remain <200ms
- **Database Connections**: Should not spike
- **Memory Usage**: Should remain stable
- **Disk Usage**: Should not exceed 80%

**Threshold Alerts**:
- Error rate >5%: Alert on-call engineer
- API latency p95 >500ms: Investigate performance regression
- Memory usage >90%: Scale dynos or investigate memory leak

---

## CI/CD Best Practices

### DO ✅

- Run all tests on every pull request
- Deploy staging automatically on merge to `main`
- Require manual approval for production deploys
- Create database backups before production deploys
- Monitor error rates post-deployment for 24 hours
- Document deployment in team wiki/Notion
- Use semantic versioning for releases (v1.2.3)

### DON'T ❌

- Deploy to production on Fridays (rollback risk over weekend)
- Skip staging deployments (always test in staging first)
- Deploy without database backup
- Deploy during peak traffic hours (12 PM - 2 PM IST)
- Merge PRs without CI passing
- Use `--force` flags in production (except emergencies)

---

## Future Enhancements (Phase 2+)

- **Blue-Green Deployments**: Zero-downtime deploys with instant rollback
- **Canary Releases**: Deploy to 10% of users first, then 100%
- **Feature Flags**: Deploy code without activating features (LaunchDarkly)
- **Automated Performance Testing**: Lighthouse CI, load testing (k6)
- **Multi-Region Deployments**: Deploy to US-East, EU-West, AP-South simultaneously

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Heroku CI/CD](https://devcenter.heroku.com/articles/github-integration)
- [Vercel Deployments](https://vercel.com/docs/deployments/overview)
- [12-Factor App Principles](https://12factor.net/)

---

**Status**: ✅ Ready for Implementation (Phase 1)
**Owner**: DevOps/Platform Team
**Last Updated**: 2025-11-14
