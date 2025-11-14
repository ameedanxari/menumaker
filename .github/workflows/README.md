# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment of the MenuMaker application.

## Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` branch
- Push to `claude/**` branches
- Pull requests to `main`

**Jobs:**
- **backend-tests**: Run backend unit tests with PostgreSQL
- **frontend-tests**: Run frontend unit tests
- **backend-build**: Build backend TypeScript to JavaScript
- **frontend-build**: Build frontend React app with Vite
- **e2e-tests**: Run Playwright E2E tests (Chromium only)
- **typecheck**: TypeScript type checking for both backend and frontend
- **security-audit**: npm audit for dependency vulnerabilities
- **ci-success**: Summary job that depends on all others

**Environment:**
- Node.js 20.x
- PostgreSQL 15
- MinIO for S3-compatible storage

**Artifacts:**
- Backend coverage reports (7 days)
- Backend build dist (7 days)
- Frontend build dist (7 days)
- Playwright reports (7 days)
- Playwright traces on failure (7 days)

### 2. Pull Request Checks (`pr-checks.yml`)

**Triggers:**
- Pull request opened, synchronized, or reopened

**Jobs:**
- **pr-validation**: Check for merge conflicts, validate commit messages, check for large files
- **code-quality**: Lint and format checking for backend and frontend
- **bundle-size**: Analyze frontend bundle size impact
- **coverage-report**: Generate test coverage report and post to PR

**Features:**
- Conventional commit format validation
- Bundle size comparison with base branch
- Automated coverage comment on PR

### 3. Nightly E2E Tests (`nightly-e2e.yml`)

**Triggers:**
- Scheduled at 2 AM UTC daily
- Manual workflow dispatch

**Jobs:**
- **e2e-full-suite**: Run full E2E suite across all browsers (Chromium, Firefox, WebKit)
- **e2e-mobile**: Run E2E tests on mobile viewports (Mobile Chrome, Mobile Safari)
- **notify-results**: Aggregate results and create GitHub issue on failure

**Features:**
- Matrix strategy for parallel browser testing
- Automatic issue creation on failure
- Extended test reports retention (14 days)
- Comprehensive mobile testing

**Benefits:**
- Catch browser-specific issues
- Detect regressions overnight
- Mobile responsiveness validation

### 4. Deployment (`deploy.yml`)

**Triggers:**
- Push to `main` (staging)
- Git tags `v*` (production)
- Manual workflow dispatch

**Jobs:**
- **deploy-staging**: Deploy to staging environment
- **deploy-production**: Deploy to production environment
- **rollback**: Automatic rollback on production failure

**Deployment Targets (Templates):**
- Heroku (backend)
- Vercel (frontend)
- AWS S3 + CloudFront (frontend)

**Features:**
- Environment-specific configurations
- Smoke tests after deployment
- Release notes generation for tags
- Automated rollback on failure

## Setup Instructions

### Required Secrets

Configure these secrets in your GitHub repository settings:

#### Staging Environment
```
STAGING_API_URL          # Backend API URL for staging
HEROKU_API_KEY          # Heroku deployment key (if using Heroku)
HEROKU_EMAIL            # Heroku account email
VERCEL_TOKEN            # Vercel deployment token (if using Vercel)
VERCEL_ORG_ID           # Vercel organization ID
VERCEL_PROJECT_ID       # Vercel project ID
AWS_ACCESS_KEY_ID       # AWS credentials (if using AWS)
AWS_SECRET_ACCESS_KEY   # AWS secret key
STAGING_CLOUDFRONT_ID   # CloudFront distribution ID
```

#### Production Environment
```
PRODUCTION_API_URL           # Backend API URL for production
PRODUCTION_DATABASE_URL      # Production database connection string
```

### Environment Configuration

GitHub environments (`staging`, `production`) should be configured with:
- **Protection rules**: Require reviews before production deployment
- **Secrets**: Environment-specific secrets
- **URLs**: Deployment URLs for easy access

### Enabling Deployments

The deployment workflows contain placeholder steps. To enable:

1. **Choose your hosting provider**
   - Backend: Heroku, Render, Railway, AWS
   - Frontend: Vercel, Netlify, Cloudflare Pages, AWS S3+CloudFront

2. **Update deploy.yml**
   - Set deployment step `if: true` to enable
   - Add provider-specific configuration
   - Configure secrets

3. **Test in staging first**
   - Deploy to staging environment
   - Verify smoke tests pass
   - Check application functionality

## Running Workflows Locally

### Testing CI Pipeline Locally

Use [act](https://github.com/nektos/act) to run GitHub Actions locally:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run default workflow
act

# Run specific workflow
act -W .github/workflows/ci.yml

# Run specific job
act -j backend-tests
```

### Manual Workflow Triggers

Some workflows support manual triggers:

```bash
# Trigger via GitHub CLI
gh workflow run nightly-e2e.yml

# Trigger deployment
gh workflow run deploy.yml -f environment=staging
```

## Workflow Best Practices

### 1. Fast Feedback
- CI pipeline runs critical checks first (lint, typecheck)
- E2E tests run in parallel where possible
- Fail fast on compilation errors

### 2. Resource Optimization
- Use caching for npm dependencies
- Upload artifacts only on failure or when needed
- Run expensive E2E tests nightly instead of on every PR

### 3. Security
- Use secrets for sensitive data
- Run security audits regularly
- Never log secrets or sensitive information

### 4. Reliability
- Configure retries for flaky tests (Playwright has 2 retries on CI)
- Use health checks for service dependencies
- Implement smoke tests after deployment

### 5. Observability
- Upload artifacts for debugging
- Create GitHub issues on nightly failures
- Post coverage reports to PRs
- Send notifications on deployment

## Monitoring and Debugging

### Viewing Workflow Runs

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

### Common Issues

**Tests Timing Out**
- Increase timeout in workflow: `timeout-minutes: 30`
- Check service health (PostgreSQL, MinIO)
- Verify backend/frontend startup

**Flaky E2E Tests**
- Review Playwright traces in artifacts
- Check explicit waits instead of timeouts
- Ensure test data isolation

**Build Failures**
- Check TypeScript errors
- Verify all dependencies installed
- Review environment variables

**Deployment Failures**
- Check secrets configuration
- Verify deployment credentials
- Review smoke test results
- Check rollback procedures

## Customization

### Adding New Checks

1. Create new job in `ci.yml`:
```yaml
new-check:
  name: New Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run check
      run: echo "Your check here"
```

2. Add to dependencies in `ci-success` job:
```yaml
ci-success:
  needs: [...existing..., new-check]
```

### Custom Deployment

1. Copy relevant template from `deploy.yml`
2. Replace placeholder commands with your deployment steps
3. Configure required secrets
4. Test with staging environment first

## Performance Metrics

### Current CI Times (Approximate)

- Backend tests: ~3-5 minutes
- Frontend tests: ~2-3 minutes
- Backend build: ~2-3 minutes
- Frontend build: ~2-4 minutes
- E2E tests (single browser): ~10-15 minutes
- Full CI pipeline: ~15-20 minutes

### Optimization Opportunities

- Parallel job execution (already implemented)
- Dependency caching (already implemented)
- Incremental builds (can be added)
- Test result caching (can be added)

## Contributing

When adding new workflows:

1. **Follow naming conventions**: Use kebab-case for file names
2. **Add documentation**: Update this README
3. **Test locally**: Use `act` to test before pushing
4. **Use existing patterns**: Follow structure of existing workflows
5. **Add error handling**: Graceful failures and rollbacks

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright CI Documentation](https://playwright.dev/docs/ci)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)

## Support

For issues with workflows:
1. Check workflow run logs in GitHub Actions
2. Download and review artifacts
3. Review this documentation
4. Consult GitHub Actions documentation
