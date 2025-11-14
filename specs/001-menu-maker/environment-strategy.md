# Environment Strategy

## Overview

MenuMaker uses a three-tier environment strategy (Development → Staging → Production) with comprehensive configuration management, debug capabilities in mobile apps, and clear promotion paths. This document defines environment architecture, configuration management, deployment workflows, and debugging strategies.

## Goals

1. **Isolated Testing**: Test changes in dev/staging without affecting production users
2. **Zero-Downtime Deployments**: Promote code through environments with confidence
3. **Debug Capabilities**: Enable QA and support teams to test in non-production environments
4. **Configuration Management**: Consistent env-specific configs across web + mobile + backend
5. **Cost-Effective**: Minimize infrastructure costs during MVP phase

## Environment Tiers

### Overview Table

| Environment | Purpose | Infrastructure | Data | URL/Access | Auto-Deploy |
|-------------|---------|----------------|------|------------|-------------|
| **Development** | Local development | Docker Compose (Postgres + MinIO) | Seed/test data | localhost:3000, localhost:5000 | No (local) |
| **Staging** | Pre-production testing, QA | Heroku Hobby tier | Production-like data (anonymized) | staging.menumaker.com | Yes (main branch) |
| **Production** | Live customer traffic | Heroku Standard tier | Real customer data | menumaker.com, api.menumaker.com | Manual (via promotion) |

### 1. Development Environment

**Purpose**: Local development on engineer machines

**Infrastructure**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: menumaker_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - minio_data:/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  pgdata:
  minio_data:
```

**Configuration** (`.env.development`):
```bash
# Database
DATABASE_URL=postgresql://dev:devpass@localhost:5432/menumaker_dev

# Storage
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=menumaker-dev

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=dev-secret-change-in-prod

# External Services (test keys)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=test_secret_xxx
TWILIO_ACCOUNT_SID=test_sid
TWILIO_AUTH_TOKEN=test_token

# Firebase (dev project)
FIREBASE_PROJECT_ID=menumaker-dev
FIREBASE_API_KEY=dev_api_key

# Logging
LOG_LEVEL=debug
SENTRY_DSN=  # Disabled in dev

# Environment
NODE_ENV=development
API_BASE_URL=http://localhost:5000
WEB_BASE_URL=http://localhost:3000
```

**Data**: Seed scripts with realistic test data

```bash
npm run db:seed
# Creates:
# - 10 test sellers
# - 50 test dishes
# - 20 test orders
# - 200 common dishes (from catalog)
```

**Access**:
- Backend API: http://localhost:5000
- Web Portal: http://localhost:3000
- MinIO Console: http://localhost:9001

**Mobile App Setup**: Apps point to localhost (iOS Simulator, Android Emulator)

```typescript
// config/environment.ts
const DEV_CONFIG = {
  apiUrl: 'http://localhost:5000/api/v1', // iOS Simulator
  // apiUrl: 'http://10.0.2.2:5000/api/v1', // Android Emulator
};
```

### 2. Staging Environment

**Purpose**: Pre-production testing, QA, demo environment

**Infrastructure**: Heroku Hobby tier (~$14/month)

```bash
# Heroku apps
menumaker-api-staging      # Backend (Node.js)
menumaker-web-staging      # Frontend (React static site)
```

**Heroku Add-ons** (Staging):
- **Postgres**: Heroku Postgres Hobby Basic ($9/month, 10M rows)
- **Redis**: Heroku Redis Hobby Dev (free, 25MB)
- **Papertrail**: Free tier (100MB logs, 7-day retention)

**Configuration** (`.env.staging` - managed via Heroku Config Vars):
```bash
# Database (Heroku managed)
DATABASE_URL=postgresql://...@...amazonaws.com:5432/d123abc

# Storage (AWS S3 - staging bucket)
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=menumaker-staging
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret...

# Redis (Heroku managed)
REDIS_URL=redis://...redislabs.com:12345

# Auth
JWT_SECRET=staging-secret-from-heroku-config

# External Services (test mode)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=test_secret_xxx
TWILIO_ACCOUNT_SID=staging_sid
TWILIO_AUTH_TOKEN=staging_token

# Firebase (staging project)
FIREBASE_PROJECT_ID=menumaker-staging
FIREBASE_API_KEY=staging_api_key

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxx@sentry.io/staging
SENTRY_ENVIRONMENT=staging

# Environment
NODE_ENV=production  # Use prod mode for realistic testing
API_BASE_URL=https://api-staging.menumaker.com
WEB_BASE_URL=https://staging.menumaker.com

# CORS (allow staging domains)
CORS_ORIGIN=https://staging.menumaker.com
```

**Data**: Production-like data (anonymized for privacy)

```bash
# Weekly refresh from production (anonymized)
npm run db:refresh-staging
# - Copies production schema
# - Anonymizes PII (emails → test+xxx@example.com, phones → +91999999xxxx)
# - Removes payment tokens
```

**URLs**:
- Backend API: https://api-staging.menumaker.com
- Web Portal: https://staging.menumaker.com
- Mobile Apps: Point to staging via debug menu

**Auto-Deploy**: CI/CD pipeline deploys on every push to `main` branch

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Heroku Staging
        run: |
          git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/menumaker-api-staging.git main
```

### 3. Production Environment

**Purpose**: Live customer traffic

**Infrastructure**: Heroku Standard tier (~$50/month)

```bash
# Heroku apps
menumaker-api-prod         # Backend (Node.js)
menumaker-web-prod         # Frontend (React static site)
```

**Heroku Add-ons** (Production):
- **Postgres**: Heroku Postgres Standard 0 ($50/month, 64GB storage, 120 connections)
- **Redis**: Heroku Redis Premium 0 ($15/month, 100MB, high availability)
- **Papertrail**: Professional ($7/month, 1GB logs, 30-day retention)

**Configuration** (`.env.production` - managed via Heroku Config Vars):
```bash
# Database (Heroku managed)
DATABASE_URL=postgresql://...@...amazonaws.com:5432/d789xyz

# Storage (AWS S3 - production bucket)
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=menumaker-production
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret...

# Redis (Heroku managed)
REDIS_URL=redis://...redislabs.com:12346

# Auth
JWT_SECRET=<strong-random-secret-from-1password>

# External Services (LIVE mode)
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=live_secret_xxx
TWILIO_ACCOUNT_SID=prod_sid
TWILIO_AUTH_TOKEN=prod_token

# Firebase (production project)
FIREBASE_PROJECT_ID=menumaker-prod
FIREBASE_API_KEY=prod_api_key

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxx@sentry.io/production
SENTRY_ENVIRONMENT=production

# Environment
NODE_ENV=production
API_BASE_URL=https://api.menumaker.com
WEB_BASE_URL=https://menumaker.com

# CORS (allow production domain only)
CORS_ORIGIN=https://menumaker.com

# Rate Limiting (stricter in prod)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

**Data**: Real customer data (GDPR compliant)

**URLs**:
- Backend API: https://api.menumaker.com
- Web Portal: https://menumaker.com

**Manual Deploy**: Requires approval, promotion from staging

```bash
# Promote staging release to production
heroku pipelines:promote -a menumaker-api-staging --to menumaker-api-prod
```

## Configuration Management

### Environment Variables

**Storage**: All environments use environment variables (12-factor app)

**Hierarchy**:
1. `.env.example` (template, committed to git)
2. `.env.development` (local, ignored by git)
3. `.env.test` (CI, ignored by git)
4. Heroku Config Vars (staging/production, not in git)

**Example `.env.example`**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Storage
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=menumaker-bucket
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change_this_in_production

# External Services
RAZORPAY_KEY_ID=rzp_test_or_live
RAZORPAY_KEY_SECRET=secret
TWILIO_ACCOUNT_SID=sid
TWILIO_AUTH_TOKEN=token

# Firebase
FIREBASE_PROJECT_ID=menumaker-project
FIREBASE_API_KEY=api_key

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxx@sentry.io/project

# Environment
NODE_ENV=development
API_BASE_URL=http://localhost:5000
WEB_BASE_URL=http://localhost:3000
```

### Mobile App Configuration

**Problem**: Mobile apps can't use environment variables

**Solution**: Build-time config + runtime environment switcher

```typescript
// config/environment.ts
export const ENV = {
  dev: {
    apiUrl: 'http://localhost:5000/api/v1',
    firebaseConfig: { /* dev project */ }
  },
  staging: {
    apiUrl: 'https://api-staging.menumaker.com/api/v1',
    firebaseConfig: { /* staging project */ }
  },
  production: {
    apiUrl: 'https://api.menumaker.com/api/v1',
    firebaseConfig: { /* prod project */ }
  }
};

// Get current environment (from build config or debug menu)
const currentEnv = __DEV__ ? 'dev' : getSelectedEnvironment();

export const config = ENV[currentEnv];
```

**Build Scripts**:
```json
{
  "scripts": {
    "ios:dev": "react-native run-ios --scheme MenuMakerDev",
    "ios:staging": "react-native run-ios --scheme MenuMakerStaging",
    "ios:prod": "react-native run-ios --scheme MenuMakerProd",
    "android:dev": "react-native run-android --variant=devDebug",
    "android:staging": "react-native run-android --variant=stagingDebug",
    "android:prod": "react-native run-android --variant=prodRelease"
  }
}
```

## Mobile App Debug Menu

**Purpose**: Allow QA and support team to switch environments without rebuilding

### Access Methods

#### Method 1: Hidden Gesture (10-tap on logo)

```typescript
// components/Header.tsx
import { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';

export function Header() {
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  const handleLogoPress = () => {
    const now = Date.now();

    // Reset if more than 2 seconds since last tap
    if (now - lastTap > 2000) {
      setTapCount(1);
    } else {
      setTapCount(tapCount + 1);
    }

    setLastTap(now);

    // Open debug menu after 10 taps
    if (tapCount >= 9) {
      navigation.navigate('DebugMenu');
      setTapCount(0);
    }
  };

  return (
    <TouchableOpacity onPress={handleLogoPress}>
      <Text>MenuMaker</Text>
    </TouchableOpacity>
  );
}
```

#### Method 2: Shake Gesture (Android/iOS)

```typescript
// App.tsx
import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import RNShake from 'react-native-shake';

useEffect(() => {
  const subscription = RNShake.addListener(() => {
    if (__DEV__) {
      navigation.navigate('DebugMenu');
    }
  });

  return () => subscription.remove();
}, []);
```

### Debug Menu Features

```typescript
// screens/DebugMenu.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export function DebugMenu() {
  const [selectedEnv, setSelectedEnv] = useState('production');
  const [verboseLogging, setVerboseLogging] = useState(false);

  useEffect(() => {
    // Load saved preferences
    AsyncStorage.getItem('debug_environment').then(env => {
      setSelectedEnv(env || 'production');
    });
    AsyncStorage.getItem('debug_verbose_logging').then(verbose => {
      setVerboseLogging(verbose === 'true');
    });
  }, []);

  const handleEnvironmentChange = async (env: string) => {
    await AsyncStorage.setItem('debug_environment', env);
    setSelectedEnv(env);
    // Restart app to apply new environment
    Alert.alert('Restart Required', 'Please restart the app to switch environments');
  };

  const handleToggleVerboseLogging = async (enabled: boolean) => {
    await AsyncStorage.setItem('debug_verbose_logging', String(enabled));
    setVerboseLogging(enabled);
  };

  const handleExportLogs = async () => {
    const logs = await getLogs(); // Retrieve stored logs
    const file = await FileSystem.writeAsStringAsync('logs.txt', logs.join('\n'));
    await Share.share({ url: file }); // Email logs to support
  };

  return (
    <View>
      <Text>Debug Menu</Text>

      <Text>Environment:</Text>
      <Picker selectedValue={selectedEnv} onValueChange={handleEnvironmentChange}>
        <Picker.Item label="Development (localhost)" value="dev" />
        <Picker.Item label="Staging" value="staging" />
        <Picker.Item label="Production" value="production" />
      </Picker>

      <Switch
        value={verboseLogging}
        onValueChange={handleToggleVerboseLogging}
      />
      <Text>Verbose Logging</Text>

      <Button title="Export Logs" onPress={handleExportLogs} />

      <Button title="Clear Cache" onPress={clearCache} />

      <Text>App Version: 1.0.0 (Build 42)</Text>
      <Text>API Version: v1</Text>
      <Text>Current Environment: {selectedEnv}</Text>
    </View>
  );
}
```

### Security Considerations

**Production Builds**: Debug menu should be disabled in production releases

```typescript
// Only enable debug menu in development or internal builds
const ENABLE_DEBUG_MENU = __DEV__ || Config.IS_INTERNAL_BUILD;

if (ENABLE_DEBUG_MENU) {
  // Allow debug menu access
} else {
  // Disable 10-tap gesture and shake listener
}
```

**Internal QA Builds**: Create separate "QA" build variant with debug menu enabled

```gradle
// android/app/build.gradle
buildTypes {
    release {
        debuggable false
        // Debug menu disabled
    }
    qa {
        debuggable false
        buildConfigField "boolean", "ENABLE_DEBUG_MENU", "true"
        // Debug menu enabled for QA team
    }
}
```

## Deployment Workflow

### CI/CD Pipeline

```
┌─────────────────────────────────────────────────────┐
│                 Developer Workflow                   │
└─────────────────────────────────────────────────────┘
          ↓
  [1] Push to feature branch
          ↓
  [2] GitHub Actions: Run tests
          ↓
  [3] Create Pull Request
          ↓
  [4] Code Review + Approval
          ↓
  [5] Merge to main branch
          ↓
  [6] AUTO-DEPLOY to Staging ✅
          ↓
  [7] QA Testing on Staging
          ↓
  [8] Manual Approval (Product/Eng Lead)
          ↓
  [9] MANUAL DEPLOY to Production 🚀
          ↓
  [10] Monitor (Sentry, Firebase, Papertrail)
```

### GitHub Actions Workflow

**File**: `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Run tests on every PR
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

  # Deploy to staging after merge to main
  deploy-staging:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Heroku Staging
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: menumaker-api-staging
          heroku_email: ${{ secrets.HEROKU_EMAIL }}

      - name: Run smoke tests on staging
        run: npm run test:smoke
        env:
          API_URL: https://api-staging.menumaker.com

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployed to staging: https://staging.menumaker.com'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # Manual production deployment (via workflow_dispatch)
  deploy-production:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Heroku Production
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: menumaker-api-prod
          heroku_email: ${{ secrets.HEROKU_EMAIL }}

      - name: Run smoke tests on production
        run: npm run test:smoke
        env:
          API_URL: https://api.menumaker.com

      - name: Create Sentry release
        run: |
          sentry-cli releases new ${{ github.sha }}
          sentry-cli releases set-commits ${{ github.sha }} --auto
          sentry-cli releases deploys ${{ github.sha }} new -e production

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: '🚀 Deployed to production: https://menumaker.com'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Manual Production Deploy

**Step-by-step**:

1. **Verify Staging**: QA team tests on staging, confirms all features working
2. **Create Release Tag**:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0: Add common dishes catalog"
   git push origin v1.0.0
   ```
3. **Trigger Production Deploy**:
   - Go to GitHub Actions
   - Select "CI/CD Pipeline" workflow
   - Click "Run workflow" → Select "main" branch → Click "Run"
4. **Monitor Deployment**:
   - Watch Heroku logs: `heroku logs --tail -a menumaker-api-prod`
   - Check Sentry for errors
   - Verify smoke tests pass
5. **Verify Production**: Manually test critical flows (signup, order, payment)

## Database Migrations

**Golden Rule**: Migrations must be backward compatible (support parallel API versions)

### Migration Strategy

```
┌─────────────────────────────────────────────────────┐
│ Safe Migration Process (Zero Downtime)              │
└─────────────────────────────────────────────────────┘

1. Add new nullable column (don't remove old column yet)
   → Deploy to staging
   → Deploy to production
   → Old API version still works (ignores new column)

2. Deploy new API version (uses new column)
   → Deploy to staging
   → Deploy to production
   → Both API versions work in parallel

3. Backfill data (populate new column from old column)
   → Run migration script
   → Verify data integrity

4. Deprecate old API version (6 months later)
   → Update deprecation headers

5. Remove old column (after old API sunset)
   → Deploy migration
   → Only new API version remains
```

### Example: Add Dish Categories

```typescript
// migration/1234567890-add-dish-categories.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddDishCategories1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create dish_categories table
    await queryRunner.createTable(new Table({
      name: 'dish_categories',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
        { name: 'name', type: 'varchar', length: '50' },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'sort_order', type: 'int', default: 0 },
        { name: 'business_id', type: 'uuid' },
        { name: 'is_default', type: 'boolean', default: false },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ],
      foreignKeys: [
        {
          columnNames: ['business_id'],
          referencedTableName: 'businesses',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE'
        }
      ]
    }));

    // Step 2: Add nullable category_id to dishes (backward compatible)
    await queryRunner.query(`
      ALTER TABLE "dishes"
      ADD COLUMN "category_id" uuid NULL
      REFERENCES "dish_categories"("id")
    `);

    // API v1 ignores category_id (remains null)
    // API v2 uses category_id
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "dishes" DROP COLUMN "category_id"');
    await queryRunner.dropTable('dish_categories');
  }
}
```

### Running Migrations

**Development**:
```bash
npm run migration:run
```

**Staging/Production**: Migrations run automatically on deploy (Heroku release phase)

```json
// package.json
{
  "scripts": {
    "heroku-postbuild": "npm run build",
    "release": "npm run migration:run"
  }
}
```

**Heroku Procfile**:
```
release: npm run release
web: npm run start:prod
```

## Monitoring & Alerts

### Environment-Specific Monitoring

| Metric | Development | Staging | Production |
|--------|-------------|---------|------------|
| Error Tracking | Console only | Sentry (staging project) | Sentry (prod project) |
| Logs | Console | Papertrail (free) | Papertrail (pro) |
| Uptime | N/A | Manual checks | UptimeRobot (5-min checks) |
| Performance | N/A | Firebase Perf | Firebase Perf + APM |
| Alerts | None | Slack notifications | PagerDuty (critical) + Slack |

### Alerting Rules (Production Only)

**Critical (PagerDuty)**:
1. API error rate >5% (5xx responses)
2. Database connection pool exhausted
3. Payment gateway failures >10 in 10 min

**Warning (Slack)**:
1. API p95 latency >1s
2. Staging deployment failed
3. Weekly prod deployment summary

## Rollback Strategy

### Heroku Rollback (Instant)

```bash
# Rollback to previous release
heroku releases:rollback -a menumaker-api-prod

# Rollback to specific version
heroku rollback v42 -a menumaker-api-prod
```

### Database Rollback (Manual)

**Problem**: Database migrations can't be auto-reversed

**Solution**: Keep migrations backward compatible, or prepare rollback script

```typescript
// If migration fails, run down() method
npm run migration:revert
```

## Cost Summary

| Environment | Infrastructure | Storage | Add-ons | Total/Month |
|-------------|----------------|---------|---------|-------------|
| Development | Local (free) | - | - | $0 |
| Staging | Heroku Hobby ($7) | S3 (~$1) | Postgres ($9), Papertrail (free) | ~$17 |
| Production | Heroku Standard ($25) | S3 (~$5) | Postgres ($50), Redis ($15), Papertrail ($7) | ~$102 |
| **Total** | | | | **~$119/month** |

## Future Enhancements

### Preview Environments (Phase 2+)

**Use Case**: Automatic PR preview deployments (like Vercel/Netlify)

**Implementation**: Heroku Review Apps

```json
// app.json
{
  "name": "menumaker",
  "environments": {
    "review": {
      "addons": [
        "heroku-postgresql:hobby-dev",
        "heroku-redis:hobby-dev"
      ],
      "env": {
        "NODE_ENV": "staging",
        "ENABLE_DEBUG_MENU": "true"
      }
    }
  }
}
```

**Cost**: $7/PR (only active PRs, auto-destroyed after merge)

### Feature Flags (Phase 3+)

**Use Case**: Gradual rollout of new features

**Tool**: LaunchDarkly or Firebase Remote Config

```typescript
// Example: Gradual rollout of common dishes feature
const featureEnabled = await remoteConfig().getValue('common_dishes_enabled');

if (featureEnabled === 'true') {
  // Show "Import from Templates" button
}
```

## Summary

### Key Features

✅ **Three-tier architecture**: Dev → Staging → Production
✅ **Mobile debug menu**: Environment switcher + verbose logging
✅ **Auto-deploy to staging**: CI/CD on every main branch push
✅ **Manual prod deploys**: Approval required for production
✅ **Backward-compatible migrations**: Support parallel API versions
✅ **Instant rollbacks**: Heroku release rollback in seconds

### Quick Reference

```bash
# Local Development
docker-compose up -d
npm run dev

# Deploy to Staging (automatic on git push)
git push origin main

# Deploy to Production (manual)
# 1. Go to GitHub Actions
# 2. Run "CI/CD Pipeline" workflow
# 3. Select "main" branch
# 4. Monitor logs

# Rollback Production
heroku releases:rollback -a menumaker-api-prod
```

---

**Status**: ✅ Ready for Implementation (Phase 1)
**Owner**: DevOps + Backend Team
**Dependencies**: Heroku account, GitHub Actions setup, mobile build configurations
