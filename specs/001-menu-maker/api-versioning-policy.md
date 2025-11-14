# API Versioning Policy

## Overview

MenuMaker implements a comprehensive API versioning strategy that enables parallel execution of multiple API versions (v1, v2, etc.) with zero-downtime deployments and graceful migrations. This document defines the versioning scheme, deprecation policy, and technical implementation for supporting backward compatibility as the platform evolves.

## Goals

1. **Zero-Downtime Deployments**: Deploy new API versions without interrupting existing clients
2. **Backward Compatibility**: Support multiple API versions in production simultaneously
3. **Clear Migration Path**: Provide clients with sufficient time and tooling to migrate
4. **Graceful Deprecation**: Sunset old versions with proper notice and warnings
5. **Future-Proof**: Architecture supports unlimited version scaling

## Versioning Scheme

### Path-Based Versioning

**Format**: `/api/v{major}/{resource}`

**Examples**:
- `/api/v1/businesses`
- `/api/v1/dishes`
- `/api/v2/orders` (future)

**Why Path-Based?**
- ✅ Explicit and visible in URLs
- ✅ Easy to route and cache
- ✅ Browser/tool-friendly (works in curl, Postman, etc.)
- ✅ RESTful convention

**Alternative Considered**: Header-based versioning (`Accept: application/vnd.menumaker.v1+json`)
- ❌ Not selected: Less visible, harder to debug, requires custom header handling

### Version Number Format

**Major versions only**: v1, v2, v3, etc.

**When to increment**:
- ✅ Breaking changes to existing endpoints (change response schema, remove fields)
- ✅ New authentication requirements
- ✅ Significant data model changes

**When NOT to increment**:
- ❌ Adding new optional fields to responses (backward compatible)
- ❌ Adding new endpoints (backward compatible)
- ❌ Bug fixes
- ❌ Performance improvements

### Version Detection

**Request**:
```http
GET /api/v1/businesses/123 HTTP/1.1
Host: api.menumaker.com
Authorization: Bearer <token>
```

**Response Headers**:
```http
HTTP/1.1 200 OK
X-API-Version: v1
X-API-Version-Latest: v1
X-API-Version-Deprecated: false
```

## Supported Versions

### Current Status (Phase 1)

| Version | Status | Released | Deprecated | Sunset | Supported Clients |
|---------|--------|----------|------------|--------|-------------------|
| v1 | Active | 2025-01 | N/A | N/A | Web, iOS, Android |

### Future Example (Phase 3+)

| Version | Status | Released | Deprecated | Sunset | Supported Clients |
|---------|--------|----------|------------|--------|-------------------|
| v1 | Deprecated | 2025-01 | 2026-06 | 2026-12 | Legacy mobile apps |
| v2 | Active | 2026-06 | N/A | N/A | Web, iOS v2+, Android v2+ |

## Deprecation Policy

### Timeline

```
Version Release
    ↓
    ├─ Active Support (minimum 12 months)
    │  - All features maintained
    │  - Bug fixes provided
    │  - Performance improvements applied
    │
    ├─ Deprecation Notice (6 months before sunset)
    │  - Deprecation headers added
    │  - Migration guide published
    │  - Email notifications sent to clients
    │
    ├─ Maintenance Mode (final 6 months)
    │  - Critical bug fixes only
    │  - No new features
    │  - Warning headers intensified
    │
    └─ Sunset (version removed)
       - Endpoints return 410 Gone
       - Force upgrade clients
```

### Minimum Support Period

- **v1**: Supported minimum 12 months after v2 release
- **v2+**: Same policy applies (12 months minimum, 6 months deprecation notice)

### Deprecation Notice Period

- **6 months**: Required notice before sunset date
- **Communication**: Email to registered developers, in-app notifications, deprecation headers

### Example Timeline

```
2025-01: v1 released
2026-06: v2 released, v1 enters "Active Support" (not deprecated yet)
2027-06: v1 deprecated (6-month notice begins)
2028-01: v1 sunset (removed)
```

## Deprecation Headers

When a version is deprecated, every response includes:

```http
HTTP/1.1 200 OK
X-API-Version: v1
X-API-Version-Deprecated: true
X-API-Version-Sunset: 2028-01-01T00:00:00Z
X-API-Version-Latest: v2
Sunset: Sat, 01 Jan 2028 00:00:00 GMT
Link: <https://docs.menumaker.com/api/v1-to-v2-migration>; rel="deprecation"
Warning: 299 - "API v1 is deprecated and will be removed on 2028-01-01. Migrate to v2: https://docs.menumaker.com/api/v1-to-v2-migration"
```

**Standard Headers**:
- `Sunset`: RFC 8594 standard sunset date
- `Warning`: RFC 7234 deprecation warning
- `Link`: Migration guide URL

## Breaking Changes

### What Constitutes a Breaking Change?

**Breaking (requires new major version)**:
- ❌ Removing a field from response
- ❌ Changing field data type (string → number)
- ❌ Renaming a field
- ❌ Changing HTTP status codes for existing behavior
- ❌ Removing an endpoint
- ❌ Changing authentication scheme
- ❌ Changing required request parameters

**Non-Breaking (can be deployed in same version)**:
- ✅ Adding new optional fields to response
- ✅ Adding new endpoints
- ✅ Adding new optional query parameters
- ✅ Relaxing validation rules (allowing more values)
- ✅ Bug fixes that don't change contracts
- ✅ Performance improvements

### Example: Breaking vs Non-Breaking

**Non-Breaking (v1 → v1.1)**:
```json
// v1 response
{
  "id": "dish_123",
  "name": "Samosa",
  "priceCents": 2000
}

// v1.1 response (added new field)
{
  "id": "dish_123",
  "name": "Samosa",
  "priceCents": 2000,
  "categoryId": "cat_456"  // ✅ New field, non-breaking
}
```

**Breaking (v1 → v2)**:
```json
// v1 response
{
  "id": "dish_123",
  "name": "Samosa",
  "priceCents": 2000
}

// v2 response (changed field type)
{
  "id": "dish_123",
  "name": "Samosa",
  "price": {              // ❌ Breaking: changed structure
    "amount": 20.00,
    "currency": "INR"
  }
}
```

## Technical Implementation

### Architecture: Multi-Version Support

**Goal**: Run v1 and v2 simultaneously on same infrastructure

**Strategy**: Route-based versioning with shared business logic

```
┌─────────────────────────────────────┐
│   API Gateway (Express Router)     │
├─────────────────────────────────────┤
│  /api/v1/*  →  V1 Controller Layer │
│  /api/v2/*  →  V2 Controller Layer │
└─────────────────────────────────────┘
           ↓           ↓
    ┌──────────────────────────┐
    │  Shared Service Layer    │
    │  (Business Logic)        │
    └──────────────────────────┘
                ↓
    ┌──────────────────────────┐
    │  Data Access Layer       │
    │  (TypeORM Repositories)  │
    └──────────────────────────┘
                ↓
         [PostgreSQL DB]
```

### Code Structure

```
src/
├── api/
│   ├── v1/
│   │   ├── controllers/
│   │   │   ├── businessController.ts
│   │   │   ├── dishController.ts
│   │   │   └── orderController.ts
│   │   ├── routes.ts           # V1 route definitions
│   │   ├── validators.ts       # V1-specific validation
│   │   └── transformers.ts     # V1 response format
│   │
│   ├── v2/                     # Future version
│   │   ├── controllers/
│   │   ├── routes.ts
│   │   ├── validators.ts
│   │   └── transformers.ts
│   │
│   └── versionMiddleware.ts    # Version detection & routing
│
├── services/                   # Shared business logic (version-agnostic)
│   ├── businessService.ts
│   ├── dishService.ts
│   └── orderService.ts
│
└── database/                   # Data access (version-agnostic)
    ├── entities/
    └── repositories/
```

### Version Detection Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

export interface VersionedRequest extends Request {
  apiVersion: 'v1' | 'v2';
  isDeprecated: boolean;
}

const VERSION_CONFIG = {
  v1: {
    deprecated: false,
    sunsetDate: null,
    latestVersion: 'v1'
  },
  // Future: v2 config
};

export function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract version from path
  const versionMatch = req.path.match(/^\/api\/(v\d+)\//);

  if (!versionMatch) {
    return res.status(400).json({
      error: 'API version required',
      message: 'Please specify API version in path: /api/v1/...'
    });
  }

  const version = versionMatch[1] as 'v1' | 'v2';
  const config = VERSION_CONFIG[version];

  if (!config) {
    return res.status(404).json({
      error: 'Unsupported API version',
      message: `Version ${version} not found. Latest version: ${VERSION_CONFIG.v1.latestVersion}`,
      supportedVersions: Object.keys(VERSION_CONFIG)
    });
  }

  // Attach version metadata to request
  (req as VersionedRequest).apiVersion = version;
  (req as VersionedRequest).isDeprecated = config.deprecated;

  // Add version headers to response
  res.setHeader('X-API-Version', version);
  res.setHeader('X-API-Version-Latest', config.latestVersion);
  res.setHeader('X-API-Version-Deprecated', String(config.deprecated));

  if (config.deprecated && config.sunsetDate) {
    res.setHeader('Sunset', new Date(config.sunsetDate).toUTCString());
    res.setHeader('Warning', `299 - "API ${version} is deprecated and will be removed on ${config.sunsetDate}. Migrate to ${config.latestVersion}."`);
    res.setHeader('Link', '<https://docs.menumaker.com/api/migration>; rel="deprecation"');
  }

  next();
}
```

### Route Registration

```typescript
import express from 'express';
import { versionMiddleware } from './api/versionMiddleware';
import v1Routes from './api/v1/routes';
import v2Routes from './api/v2/routes'; // Future

const app = express();

// Apply version detection middleware
app.use('/api', versionMiddleware);

// Register versioned routes
app.use('/api/v1', v1Routes);
// app.use('/api/v2', v2Routes); // Enabled when v2 launched

// Catch-all for unsupported versions
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API version not found',
    supportedVersions: ['v1']
  });
});
```

### Response Transformers (Adapter Pattern)

**Purpose**: Transform internal data models to version-specific response formats

```typescript
// src/api/v1/transformers.ts
import { Dish } from '../../database/entities/Dish';

export function transformDishToV1(dish: Dish) {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    priceCents: dish.priceCents,
    imageUrl: dish.imageUrl,
    allergens: dish.allergens,
    available: dish.available,
    createdAt: dish.createdAt.toISOString(),
    updatedAt: dish.updatedAt.toISOString()
  };
}

// Future: src/api/v2/transformers.ts
export function transformDishToV2(dish: Dish) {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: {                    // ⬅️ Breaking change: nested structure
      amount: dish.priceCents / 100,
      currency: 'INR'
    },
    imageUrl: dish.imageUrl,
    allergens: dish.allergens,
    available: dish.available,
    categoryId: dish.categoryId, // ⬅️ New field in v2
    timestamps: {                // ⬅️ Breaking change: nested timestamps
      created: dish.createdAt.toISOString(),
      updated: dish.updatedAt.toISOString()
    }
  };
}
```

## Database Schema Versioning

### Strategy: Shared Schema with Nullable New Fields

**Goal**: Single database schema supports multiple API versions

**Approach**:
- v1 uses existing fields
- v2 adds new nullable columns
- Migrations ensure backward compatibility

**Example Migration (v1 → v2)**:

```typescript
// migration/1234567890-add-dish-category.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDishCategory1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new column for v2 (nullable for v1 compatibility)
    await queryRunner.query(`
      ALTER TABLE "dishes"
      ADD COLUMN "category_id" uuid NULL
      REFERENCES "dish_categories"("id")
    `);

    // v1 clients: category_id remains null
    // v2 clients: category_id populated
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dishes"
      DROP COLUMN "category_id"
    `);
  }
}
```

### Data Transformation at API Layer

```typescript
// V1 controller: ignore categoryId
export async function getDishV1(req: Request, res: Response) {
  const dish = await dishService.getDish(req.params.id);

  // V1 transformer ignores categoryId field
  res.json(transformDishToV1(dish));
}

// V2 controller: include categoryId
export async function getDishV2(req: Request, res: Response) {
  const dish = await dishService.getDish(req.params.id);

  // V2 transformer includes categoryId field
  res.json(transformDishToV2(dish));
}
```

## Zero-Downtime Deployment

### Blue-Green Deployment Strategy

**Goal**: Deploy new API version without downtime

**Steps**:
1. **Deploy v2 alongside v1** (both versions active)
2. **Test v2** in production with internal traffic
3. **Gradual Rollout**: Route small % of traffic to v2
4. **Monitor**: Watch error rates, latency, crash-free rate
5. **Full Cutover**: Once stable, route all v2 clients to v2
6. **Maintain v1**: Keep v1 active for 12+ months

**Infrastructure** (Heroku example):

```bash
# Deploy new release with both v1 and v2 routes
git push heroku main

# Both versions live immediately:
# - /api/v1/* → still works
# - /api/v2/* → now available

# No downtime: existing v1 clients unaffected
```

### Database Migrations

**Golden Rule**: Migrations must be backward compatible

**Safe Migration Pattern**:
1. ✅ Add new nullable columns (v2 uses them, v1 ignores them)
2. ✅ Add new tables (v2 uses them, v1 ignores them)
3. ✅ Add indexes (improves performance for all versions)

**Unsafe Patterns**:
- ❌ Dropping columns still used by v1
- ❌ Changing column types (breaks v1 queries)
- ❌ Renaming columns (v1 queries fail)

**Solution for Breaking DB Changes**:
1. Deploy v2 with new columns added (old columns remain)
2. Wait for v1 sunset (6+ months)
3. Only then drop old columns

## Client Migration Guide

### For Mobile Apps (iOS/Android)

**Strategy**: App Store releases force upgrades

```
App v1.0 → API v1
App v1.5 → API v1 (still works)
App v2.0 → API v2 (requires update)

Timeline:
- 2025-01: Release App v1.0 (API v1)
- 2026-06: Release App v2.0 (API v2)
- 2027-06: Deprecate API v1 (App v1.x still works, warning banner shown)
- 2028-01: Sunset API v1 (App v1.x returns "Please update" error)
```

**Forced Upgrade Implementation**:

```typescript
// Backend checks min app version
export function checkAppVersion(req: Request, res: Response, next: NextFunction) {
  const appVersion = req.headers['x-app-version'] as string;
  const platform = req.headers['x-platform'] as string; // 'ios' | 'android'

  const MIN_VERSIONS = {
    ios: '2.0.0',     // If v1 API sunset, require iOS app v2+
    android: '2.0.0'
  };

  if (appVersion && platform) {
    const minVersion = MIN_VERSIONS[platform];
    if (compareVersions(appVersion, minVersion) < 0) {
      return res.status(426).json({
        error: 'Upgrade required',
        message: 'Please update to the latest version',
        minVersion,
        downloadUrl: platform === 'ios'
          ? 'https://apps.apple.com/app/menumaker'
          : 'https://play.google.com/store/apps/menumaker'
      });
    }
  }

  next();
}
```

### For Web App

**Strategy**: Automatic upgrade (SPA reloads latest code)

- Web app always uses latest API version
- No forced upgrade needed (deploys automatically)

### For API Clients (Third-Party Integrations)

**Communication**:
1. Email notification (6 months before sunset)
2. Dashboard banner (3 months before sunset)
3. Deprecation headers (from deprecation date)
4. 410 Gone response (after sunset date)

**Migration Checklist**:
```markdown
## API v1 → v2 Migration Checklist

### 1. Update Base URL
- ❌ Old: https://api.menumaker.com/api/v1/
- ✅ New: https://api.menumaker.com/api/v2/

### 2. Response Schema Changes
- `priceCents` → `price.amount` (divided by 100)
- `createdAt`/`updatedAt` → `timestamps.created`/`timestamps.updated`
- New field: `categoryId` (nullable)

### 3. Test in Staging
- Staging endpoint: https://staging-api.menumaker.com/api/v2/
- Use test credentials: ...

### 4. Monitor Errors
- Check for 400/500 responses
- Validate new response schemas
```

## Sunset Process

### When v1 Sunset Date Arrives

**Step 1: API Returns 410 Gone**

```typescript
// All v1 endpoints
app.use('/api/v1', (req, res) => {
  res.status(410).json({
    error: 'API version sunset',
    message: 'API v1 was sunset on 2028-01-01. Please migrate to v2.',
    migrationGuide: 'https://docs.menumaker.com/api/v1-to-v2-migration',
    latestVersion: 'v2',
    supportEmail: 'support@menumaker.com'
  });
});
```

**Step 2: Remove v1 Code**

Wait 30 days after sunset, then:
```bash
# Remove v1 codebase
rm -rf src/api/v1/

# Update version config
# Remove v1 from supported versions
```

## Testing Strategy

### Contract Testing

**Ensure API contracts don't break accidentally**

```typescript
// tests/api/v1/contracts/dish.test.ts
import request from 'supertest';
import app from '../../../src/app';

describe('API v1 - Dish Contract', () => {
  it('GET /api/v1/dishes/:id returns expected schema', async () => {
    const response = await request(app)
      .get('/api/v1/dishes/test-dish-id')
      .expect(200);

    // Validate exact schema (any change breaks this test)
    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      priceCents: expect.any(Number),
      imageUrl: expect.any(String),
      allergens: expect.any(Array),
      available: expect.any(Boolean),
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });

    // Ensure no unexpected fields (breaking change)
    expect(Object.keys(response.body)).toEqual([
      'id', 'name', 'description', 'priceCents', 'imageUrl',
      'allergens', 'available', 'createdAt', 'updatedAt'
    ]);
  });
});
```

### Parallel Version Testing

**Run same tests against v1 and v2**

```typescript
const VERSIONS = ['v1', 'v2'];

VERSIONS.forEach(version => {
  describe(`API ${version} - Order Flow`, () => {
    it('creates order successfully', async () => {
      const response = await request(app)
        .post(`/api/${version}/orders`)
        .send(/* test data */)
        .expect(201);

      // Version-agnostic assertions
      expect(response.body.id).toBeDefined();
    });
  });
});
```

## Monitoring

### Key Metrics per Version

**Dashboard**: Track usage by API version

| Metric | v1 | v2 |
|--------|----|----|
| Requests/min | 1,200 | 300 |
| Error rate | 0.5% | 0.3% |
| p95 latency | 450ms | 380ms |
| Active clients | 5,000 | 1,200 |

**Alerts**:
- **v1 usage spike** after v2 release (migration not happening?)
- **v2 error rate** higher than v1 (regression?)

## Documentation

### API Reference

Maintain separate documentation per version:

- **v1 Docs**: https://docs.menumaker.com/api/v1/
- **v2 Docs**: https://docs.menumaker.com/api/v2/

Use **OpenAPI Spec** for auto-generated docs:

```yaml
# contracts/api.v1.openapi.yaml
openapi: 3.0.0
info:
  title: MenuMaker API
  version: 1.0.0
  description: API v1 (Active)
servers:
  - url: https://api.menumaker.com/api/v1

# contracts/api.v2.openapi.yaml (future)
openapi: 3.0.0
info:
  title: MenuMaker API
  version: 2.0.0
  description: API v2 (Latest)
servers:
  - url: https://api.menumaker.com/api/v2
```

## Summary

### Key Policies

✅ **Path-based versioning**: `/api/v1/`, `/api/v2/`
✅ **12-month minimum support**: v1 supported 12+ months after v2 release
✅ **6-month deprecation notice**: Email + headers 6 months before sunset
✅ **Zero-downtime deployments**: v1 and v2 run in parallel
✅ **Backward-compatible migrations**: Database changes don't break old versions
✅ **Forced upgrades**: Mobile apps show "Please update" after sunset

### Quick Reference

```
┌─────────────────────────────────────────────────────┐
│ API Version Lifecycle                               │
├─────────────────────────────────────────────────────┤
│ Release → 12 months → Deprecation → 6 months → Sunset │
│                       (warnings)               (410) │
└─────────────────────────────────────────────────────┘
```

---

**Status**: ✅ Ready for Implementation (Phase 1 - v1 only)
**Owner**: Backend Team
**Dependencies**: Express router setup, version middleware
