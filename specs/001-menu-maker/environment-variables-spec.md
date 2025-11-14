# Environment Variables Specification

**Version**: 1.0
**Phase**: Phase 1 (MVP)
**Last Updated**: 2025-11-12

---

## Overview

This document specifies all environment variables required for MenuMaker backend and frontend applications across development, staging, and production environments.

---

## Backend Environment Variables

### Complete .env.example (Backend)

```bash
# ===== APPLICATION =====
# Node environment: 'development' | 'staging' | 'production'
NODE_ENV=development

# Server port (default: 3000)
PORT=3000

# API base path (default: /api/v1)
API_BASE_PATH=/api/v1

# ===== DATABASE =====
# PostgreSQL connection string (preferred method)
DATABASE_URL=postgresql://menumaker_user:menumaker_password_dev_only@localhost:5432/menumaker_dev

# Or individual connection parameters (if DATABASE_URL not provided)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=menumaker_dev
DB_USER=menumaker_user
DB_PASSWORD=menumaker_password_dev_only
DB_SSL=false

# Database connection pool settings
DB_POOL_MIN=2
DB_POOL_MAX=10

# Enable SQL query logging (development only)
DB_LOGGING=true

# ===== JWT AUTHENTICATION =====
# JWT secret (min 32 characters, use: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=dev-secret-key-min-32-chars-long-replace-in-production

# Token expiry durations (examples: 15m, 1h, 7d, 30d)
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# ===== REDIS =====
# Redis connection (for sessions, rate limiting, caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_dev_only

# Or Redis connection string
# REDIS_URL=redis://:redis_password_dev_only@localhost:6379

# Redis database number (0-15)
REDIS_DB=0

# ===== STORAGE (S3/MinIO) =====
# S3-compatible storage endpoint (MinIO for dev, omit for AWS S3)
S3_ENDPOINT=http://localhost:9000

# AWS region
S3_REGION=us-east-1

# AWS credentials
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Bucket names
S3_BUCKET_DISHES=menumaker-dev-dishes
S3_BUCKET_LOGOS=menumaker-dev-logos
S3_BUCKET_MENUS=menumaker-dev-menus

# CDN base URL (CloudFront for prod, MinIO endpoint for dev)
CDN_BASE_URL=http://localhost:9000

# Storage settings
S3_FORCE_PATH_STYLE=true  # Required for MinIO, false for AWS S3

# ===== FILE UPLOAD =====
# Maximum file sizes (in bytes)
MAX_DISH_IMAGE_SIZE_MB=2
MAX_LOGO_SIZE_MB=1
MAX_MENU_PREVIEW_SIZE_MB=0.5

# Allowed image formats (comma-separated)
ALLOWED_IMAGE_FORMATS=image/jpeg,image/png,image/webp,image/heic

# ===== GOOGLE MAPS API =====
# Google Maps Geocoding API key (for delivery fee calculation)
GOOGLE_MAPS_API_KEY=

# Geocoding settings
GEOCODING_TIMEOUT_MS=5000
GEOCODING_CACHE_ENABLED=true
GEOCODING_CACHE_TTL_DAYS=90

# Maximum delivery distance in kilometers (optional)
DELIVERY_MAX_DISTANCE_KM=50

# ===== CORS =====
# Allowed origins (comma-separated for multiple)
CORS_ORIGIN=http://localhost:5173

# CORS credentials
CORS_CREDENTIALS=true

# ===== RATE LIMITING =====
# Global rate limit (requests per window)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Auth endpoints rate limit (stricter)
AUTH_RATE_LIMIT_MAX=5
AUTH_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Upload endpoints rate limit
UPLOAD_RATE_LIMIT_MAX=10
UPLOAD_RATE_LIMIT_WINDOW_MS=60000  # 1 minute

# ===== LOGGING =====
# Log level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
LOG_LEVEL=debug

# Log format: 'json' | 'pretty'
LOG_FORMAT=pretty

# Enable request logging
LOG_REQUESTS=true

# Log file path (optional, defaults to console only)
LOG_FILE_PATH=./logs/app.log

# ===== SECURITY =====
# Password hashing (bcrypt)
BCRYPT_SALT_ROUNDS=10

# Helmet.js settings (security headers)
HELMET_ENABLED=true

# HTTPS enforcement in production
HTTPS_ONLY=false  # Set to true in production

# ===== EMAIL (Phase 2) =====
# SMTP settings (for order notifications)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false  # true for 465, false for other ports
# SMTP_USER=noreply@menumaker.app
# SMTP_PASSWORD=

# Email sender details
# EMAIL_FROM_NAME=MenuMaker
# EMAIL_FROM_ADDRESS=noreply@menumaker.app

# ===== WEBHOOKS (Phase 2) =====
# WhatsApp Business API (for order notifications)
# WHATSAPP_API_KEY=
# WHATSAPP_PHONE_NUMBER_ID=

# ===== MONITORING (Phase 2) =====
# Sentry DSN (error tracking)
# SENTRY_DSN=

# New Relic license key (performance monitoring)
# NEW_RELIC_LICENSE_KEY=
# NEW_RELIC_APP_NAME=MenuMaker-Backend

# ===== PAYMENT GATEWAYS (Phase 2) =====
# Stripe
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# Razorpay (India)
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# RAZORPAY_WEBHOOK_SECRET=

# ===== CRON JOBS =====
# Enable cron jobs
CRON_ENABLED=false  # Set to true in production

# Cleanup expired tokens (cron expression: 0 2 * * * = daily at 2 AM)
CRON_CLEANUP_TOKENS=0 2 * * *

# Geocoding cache cleanup (cron expression: 0 3 * * 0 = weekly at 3 AM Sunday)
CRON_CLEANUP_GEOCODING_CACHE=0 3 * * 0

# ===== FEATURE FLAGS =====
# Enable OCR endpoint (stub in Phase 1, full implementation in Phase 2)
FEATURE_OCR_ENABLED=false

# Enable referral system (Phase 2)
FEATURE_REFERRALS_ENABLED=false

# Enable admin backend (Phase 3)
FEATURE_ADMIN_ENABLED=false

# ===== DEVELOPMENT ONLY =====
# Enable API documentation (Swagger UI)
API_DOCS_ENABLED=true

# Seed database with test data on startup
SEED_TEST_DATA=false

# Enable debug mode (verbose error messages)
DEBUG_MODE=true
```

---

## Frontend Environment Variables

### Complete .env.example (Frontend)

```bash
# ===== VITE CONFIGURATION =====
# Backend API base URL
VITE_API_BASE_URL=http://localhost:3000/api/v1

# CDN base URL (for images)
VITE_CDN_BASE_URL=http://localhost:9000

# ===== APPLICATION =====
# App name (displayed in UI)
VITE_APP_NAME=MenuMaker

# App environment: 'development' | 'staging' | 'production'
VITE_APP_ENV=development

# App version (from package.json or manual)
VITE_APP_VERSION=1.0.0

# ===== FEATURE FLAGS =====
# Enable OCR image upload (Phase 2)
VITE_FEATURE_OCR_ENABLED=false

# Enable referral system (Phase 2)
VITE_FEATURE_REFERRALS_ENABLED=false

# Enable social login (Phase 2)
VITE_FEATURE_SOCIAL_LOGIN_ENABLED=false

# ===== ANALYTICS (Phase 2) =====
# Google Analytics measurement ID
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Mixpanel project token
# VITE_MIXPANEL_TOKEN=

# ===== MAPS =====
# Google Maps API key (for delivery address autocomplete)
VITE_GOOGLE_MAPS_API_KEY=

# Default map center (latitude, longitude)
VITE_MAP_DEFAULT_LAT=28.6139
VITE_MAP_DEFAULT_LNG=77.2090

# ===== PAYMENT GATEWAYS (Phase 2) =====
# Stripe publishable key
# VITE_STRIPE_PUBLISHABLE_KEY=

# Razorpay key ID
# VITE_RAZORPAY_KEY_ID=

# ===== ERROR TRACKING (Phase 2) =====
# Sentry DSN (frontend)
# VITE_SENTRY_DSN=

# ===== SOCIAL SHARING =====
# Default social preview image (for menu sharing)
VITE_DEFAULT_SOCIAL_IMAGE_URL=https://menumaker.app/og-image.jpg

# Twitter handle (for Twitter Cards)
VITE_TWITTER_HANDLE=@MenuMakerApp

# ===== LOCALIZATION (Phase 2) =====
# Default language
VITE_DEFAULT_LOCALE=en

# Supported languages (comma-separated)
VITE_SUPPORTED_LOCALES=en,hi,ta,te

# ===== DEVELOPMENT ONLY =====
# Enable React DevTools
VITE_ENABLE_DEVTOOLS=true

# Enable verbose logging
VITE_DEBUG_MODE=true

# Mock API responses (for development without backend)
VITE_MOCK_API=false
```

---

## Environment-Specific Configurations

### Development (.env.development)

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://menumaker_user:menumaker_password_dev_only@localhost:5432/menumaker_dev
JWT_SECRET=dev-secret-key-min-32-chars-long-replace-in-production
S3_ENDPOINT=http://localhost:9000
CDN_BASE_URL=http://localhost:9000
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
LOG_FORMAT=pretty
API_DOCS_ENABLED=true
DEBUG_MODE=true
HTTPS_ONLY=false
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://menumaker_user:SECURE_PASSWORD@staging-db.example.com:5432/menumaker_staging
JWT_SECRET=SECURE_RANDOM_64_CHAR_STRING_GENERATED_WITH_CRYPTO
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_DISHES=menumaker-staging-dishes
CDN_BASE_URL=https://cdn-staging.menumaker.app
CORS_ORIGIN=https://staging.menumaker.app
LOG_LEVEL=info
LOG_FORMAT=json
API_DOCS_ENABLED=true
DEBUG_MODE=false
HTTPS_ONLY=true
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://menumaker_user:SECURE_PASSWORD@prod-db.example.com:5432/menumaker_prod
JWT_SECRET=SECURE_RANDOM_64_CHAR_STRING_GENERATED_WITH_CRYPTO
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_DISHES=menumaker-prod-dishes
CDN_BASE_URL=https://cdn.menumaker.app
CORS_ORIGIN=https://menumaker.app,https://www.menumaker.app
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/menumaker/app.log
API_DOCS_ENABLED=false
DEBUG_MODE=false
HTTPS_ONLY=true
CRON_ENABLED=true
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
NEW_RELIC_LICENSE_KEY=NRJS-xxxxxxxxxxxx
```

---

## Secrets Management

### Development

**Method:** Local `.env` file (gitignored)

**Setup:**
```bash
cp .env.example .env
# Edit .env with your local values
```

### Staging/Production

**Method:** Environment-specific secrets management

**Options:**

#### 1. AWS Secrets Manager (Recommended)

```bash
# Store secret
aws secretsmanager create-secret \
  --name menumaker/prod/jwt-secret \
  --secret-string "SECURE_RANDOM_STRING"

# Backend code (Node.js)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString!;
}

// Load on startup
const jwtSecret = await getSecret('menumaker/prod/jwt-secret');
```

#### 2. HashiCorp Vault

```bash
# Store secret
vault kv put secret/menumaker/prod jwt_secret="SECURE_RANDOM_STRING"

# Retrieve secret
vault kv get -field=jwt_secret secret/menumaker/prod
```

#### 3. Docker Secrets (Docker Swarm)

```bash
# Create secret
echo "SECURE_RANDOM_STRING" | docker secret create jwt_secret -

# Use in docker-compose.yml
secrets:
  jwt_secret:
    external: true
```

#### 4. Kubernetes Secrets

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: menumaker-secrets
type: Opaque
stringData:
  jwt-secret: SECURE_RANDOM_STRING
  db-password: SECURE_DB_PASSWORD
```

---

## Environment Variable Validation

### Backend (Zod Schema)

```typescript
// src/config/env.validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().regex(/^\d+[smhd]$/),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().regex(/^\d+[smhd]$/),

  // Redis
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional(),

  // S3
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET_DISHES: z.string(),
  S3_BUCKET_LOGOS: z.string(),
  S3_BUCKET_MENUS: z.string(),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:');
    console.error(error);
    process.exit(1);
  }
}
```

**Usage:**
```typescript
// src/index.ts
import { validateEnv } from './config/env.validation';

// Validate on startup
const env = validateEnv();

console.log('✅ Environment variables validated successfully');
```

---

## Security Best Practices

### 1. Never Commit Secrets

**gitignore:**
```gitignore
# Environment files
.env
.env.local
.env.development.local
.env.staging.local
.env.production.local

# Logs
logs/
*.log

# Secrets
secrets/
*.pem
*.key
```

### 2. Generate Strong Secrets

**JWT Secret (64 bytes):**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Database Password (32 chars, alphanumeric + special):**
```bash
openssl rand -base64 32
```

### 3. Rotate Secrets Regularly

- JWT Secret: Every 90 days (requires user re-authentication)
- Database Password: Every 180 days
- API Keys: Every 365 days

### 4. Restrict Access

**AWS IAM Policy (S3 example):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::menumaker-prod-dishes/*"
    }
  ]
}
```

### 5. Use Different Secrets Per Environment

**Never reuse production secrets in staging/development!**

```bash
# ❌ BAD
JWT_SECRET=same-secret-everywhere

# ✅ GOOD
# Development: dev-secret-key-min-32-chars-long
# Staging: staging-secret-key-different-from-dev
# Production: prod-secret-key-completely-different
```

---

## Checklist: Environment Setup

### Development Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Set `NODE_ENV=development`
- [ ] Configure local database connection
- [ ] Set minimal JWT secret (32+ chars)
- [ ] Configure MinIO endpoint (`http://localhost:9000`)
- [ ] Set CORS origin to frontend URL (`http://localhost:5173`)
- [ ] (Optional) Add Google Maps API key for delivery fee testing

### Staging Deployment
- [ ] Use secure secrets management (AWS Secrets Manager, Vault)
- [ ] Generate strong JWT secret (64 bytes)
- [ ] Configure staging database (managed service)
- [ ] Configure AWS S3 (staging buckets)
- [ ] Configure CloudFront CDN
- [ ] Set CORS origin to staging frontend URL
- [ ] Enable HTTPS enforcement
- [ ] Configure Sentry for error tracking
- [ ] Validate all required environment variables on startup

### Production Deployment
- [ ] Use secure secrets management (AWS Secrets Manager, Vault)
- [ ] Generate new JWT secret (different from staging)
- [ ] Configure production database (managed service, read replicas)
- [ ] Configure AWS S3 (production buckets with backup)
- [ ] Configure CloudFront CDN with edge caching
- [ ] Set CORS origin to production domains (comma-separated)
- [ ] Enable HTTPS enforcement (strict)
- [ ] Configure Sentry + New Relic monitoring
- [ ] Enable cron jobs for cleanup tasks
- [ ] Set up log aggregation (CloudWatch, Datadog)
- [ ] Disable API documentation (`API_DOCS_ENABLED=false`)
- [ ] Disable debug mode (`DEBUG_MODE=false`)

---

## Environment Variable Loading Order

### Backend (Node.js)

1. System environment variables
2. `.env.${NODE_ENV}.local` (e.g., `.env.production.local`)
3. `.env.${NODE_ENV}` (e.g., `.env.production`)
4. `.env.local` (not loaded in test environment)
5. `.env`

**Implementation (using `dotenv`):**
```typescript
// src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment files in order
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, `../../.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(__dirname, `../../.env.${nodeEnv}.local`) });
```

### Frontend (Vite)

Vite automatically loads environment variables from:
1. `.env` (all environments)
2. `.env.local` (all environments, gitignored)
3. `.env.[mode]` (e.g., `.env.production`)
4. `.env.[mode].local` (e.g., `.env.production.local`, gitignored)

**Note:** Only variables prefixed with `VITE_` are exposed to client-side code.

---

**Document Status**: ✅ Complete
**Implementation Estimate**: 1 day (setup across environments)
**Dependencies**: dotenv (backend), Vite (frontend)
**Next**: Create .env.example files → Validate on startup → Document secrets rotation policy
