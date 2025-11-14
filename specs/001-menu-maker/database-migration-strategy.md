# Database Migration Strategy

**Date**: 2025-11-14
**Status**: ✅ Ready for Implementation
**ORM**: TypeORM 0.3.x
**Database**: PostgreSQL 15+

---

## Overview

MenuMaker uses TypeORM migrations to manage database schema changes across all development phases (Phase 1-3.5). This document defines migration strategies for intra-phase changes and cross-phase upgrades.

---

## Migration Philosophy

### Principles

1. **Always Forward-Compatible**: New migrations must not break running code
2. **Zero-Downtime Deployments**: Schema changes deployed before code changes
3. **Rollback-Safe**: All migrations have reversible `down()` methods
4. **Idempotent**: Migrations can be re-run safely (check existence before creating)
5. **Tested in Staging**: All migrations tested with production-like data volumes

### Migration Types

| Type | Description | Downtime Risk | Example |
|------|-------------|---------------|---------|
| **Additive** | Add new tables/columns | Low (zero downtime) | Add `referral_code` column to `users` table |
| **Transformative** | Modify existing data | Medium (requires backfill) | Migrate `allergen_tags` from string to enum |
| **Destructive** | Remove tables/columns | High (requires code deployment first) | Drop deprecated `old_menu_format` table |

---

## TypeORM Migration Setup

### Configuration

**File**: `backend/src/data-source.ts`

```typescript
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load .env

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/models/**/*.entity.ts'],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
  synchronize: false, // NEVER true in production
  logging: process.env.NODE_ENV === 'development',
  migrationsRun: false, // Manual migration via npm script
});
```

### NPM Scripts

**File**: `backend/package.json`

```json
{
  "scripts": {
    "migrate:create": "typeorm migration:create",
    "migrate:generate": "typeorm migration:generate -d src/data-source.ts",
    "migrate:run": "typeorm migration:run -d src/data-source.ts",
    "migrate:revert": "typeorm migration:revert -d src/data-source.ts",
    "migrate:show": "typeorm migration:show -d src/data-source.ts",
    "migrate:test": "NODE_ENV=test typeorm migration:run -d src/data-source.ts"
  }
}
```

### Migration File Naming Convention

```
src/migrations/
├── 1699999999001-CreateInitialSchema.ts
├── 1699999999002-AddBusinessSettings.ts
├── 1699999999003-AddCommonDishCatalog.ts
├── 1700000000001-Phase2AddReferralSystem.ts
├── 1700000000002-Phase2AddUserConsent.ts
├── 1700000100001-Phase3AddAdminBackend.ts
└── ...
```

**Naming Pattern**: `{timestamp}-{PascalCaseDescription}.ts`

---

## Phase 1: Initial Schema Migration

### Migration 001: Create Initial Schema

**File**: `src/migrations/1699999999001-CreateInitialSchema.ts`

Creates all Phase 1 tables:
- User
- Business
- BusinessSettings
- Dish
- DishCategory
- Menu
- MenuItem
- Order
- OrderItem
- OrderNotification
- Payout
- CommonDish (pre-populated catalog)

**Key Features**:
- Foreign key constraints with `ON DELETE CASCADE` where appropriate
- Indexes on frequently queried columns
- Check constraints for data validation
- Default values for timestamps

**Estimated Duration**:
- Empty database: ~500ms
- Already populated (development): N/A (fresh install only)

**Rollback**: Drops all tables in reverse dependency order

---

### Migration 002: Seed CommonDish Catalog

**File**: `src/migrations/1699999999002-SeedCommonDishCatalog.ts`

Inserts ~200 pre-populated dish templates from `common-dishes-catalog.md`.

**Example**:

```typescript
export class SeedCommonDishCatalog1699999999002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO common_dishes (id, name, description, category, subcategory, min_price_cents, max_price_cents, default_allergens, aliases, popularity_score, active)
      VALUES
        ('uuid1', 'Samosa', 'Crispy fried pastry with potato filling', 'north_indian', 'appetizers', 1000, 3000, ARRAY['gluten'], ARRAY['Samsa', 'Sambosa'], 95, true),
        ('uuid2', 'Masala Dosa', 'Crispy rice crepe with spiced potato filling', 'south_indian', 'mains', 4000, 10000, ARRAY['gluten'], ARRAY['Dosa'], 98, true),
        ...
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM common_dishes`);
  }
}
```

**Rollback**: Deletes all seeded data

---

## Phase 2: Growth Features Migration

### Migration 101: Add Referral System

**File**: `src/migrations/1700000000001-Phase2AddReferralSystem.ts`

**Changes**:
1. **New Table**: `referrals` (see data-model.md for schema)
2. **Modify User Table**: Add columns:
   - `referral_code` (varchar, unique, nullable)
   - `account_credit_cents` (integer, default 0)
   - `pro_tier_expires_at` (timestamp, nullable)
   - `referred_by_code` (varchar, nullable)

**Migration Strategy**: Additive (zero downtime)

```typescript
export class Phase2AddReferralSystem1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create referrals table
    await queryRunner.query(`
      CREATE TABLE referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referral_code VARCHAR(12) UNIQUE NOT NULL,
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referee_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'link_clicked',
        ... (see data-model.md for full schema)
      )
    `);

    // Step 2: Add indexes
    await queryRunner.query(`
      CREATE INDEX idx_referrals_code ON referrals(referral_code);
      CREATE INDEX idx_referrals_referrer_status ON referrals(referrer_id, status);
    `);

    // Step 3: Add User table columns (nullable, safe to add)
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN referral_code VARCHAR(12) UNIQUE,
      ADD COLUMN account_credit_cents INTEGER DEFAULT 0,
      ADD COLUMN pro_tier_expires_at TIMESTAMP,
      ADD COLUMN referred_by_code VARCHAR(12);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE referrals CASCADE`);
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN referral_code,
      DROP COLUMN account_credit_cents,
      DROP COLUMN pro_tier_expires_at,
      DROP COLUMN referred_by_code;
    `);
  }
}
```

**Downtime**: ✅ Zero (additive changes only)

**Backfill**: None required (all new features)

---

### Migration 102: Add User Consent (GDPR Foundation)

**File**: `src/migrations/1700000000002-Phase2AddUserConsent.ts`

**Changes**:
1. **New Table**: `user_consents` (GDPR consent tracking)
2. **Modify User Table**: Add columns:
   - `deleted_at` (timestamp, nullable) - Soft delete timestamp
   - `deletion_scheduled_for` (timestamp, nullable) - Hard deletion date

**Migration Strategy**: Additive (zero downtime)

```typescript
export class Phase2AddUserConsent1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_consents table
    await queryRunner.query(`
      CREATE TABLE user_consents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        consent_type VARCHAR(50) NOT NULL,
        granted BOOLEAN DEFAULT false,
        version VARCHAR(20),
        ip_address VARCHAR(45),
        user_agent TEXT,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
      )
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX idx_user_consents_user_type ON user_consents(user_id, consent_type);
      CREATE INDEX idx_user_consents_granted_at ON user_consents(granted_at);
    `);

    // Add soft delete columns to users table
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN deleted_at TIMESTAMP,
      ADD COLUMN deletion_scheduled_for TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE user_consents CASCADE`);
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN deleted_at,
      DROP COLUMN deletion_scheduled_for;
    `);
  }
}
```

---

### Migration 103: Add Review System

**File**: `src/migrations/1700000000003-Phase2AddReviews.ts`

**Changes**:
1. **New Table**: `reviews` (customer reviews for businesses)

**Migration Strategy**: Additive (zero downtime)

---

## Phase 3: Scale Features Migration

### Migration 201: Add Admin Backend Tables

**File**: `src/migrations/1700000100001-Phase3AddAdminBackend.ts`

**Changes**:
1. **New Tables**:
   - `admin_users` (admin authentication)
   - `audit_logs` (immutable admin action log)
   - `support_tickets` (customer support)
   - `ticket_messages` (support conversation)
   - `feature_flags` (feature toggle system)
   - `content_flags` (content moderation queue)

2. **Modify User Table**: Add columns:
   - `account_status` (varchar, default 'active') - active, suspended, banned, pending_deletion
   - `suspended_until` (timestamp, nullable)
   - `suspension_reason` (varchar, nullable)

**Migration Strategy**: Additive (zero downtime)

**Seed Data**: Create first super admin account

```typescript
export class Phase3AddAdminBackend1700000100001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create admin_users table
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(500) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'support_agent',
        is_active BOOLEAN DEFAULT true,
        two_factor_secret VARCHAR(255),
        two_factor_enabled BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP,
        last_login_ip VARCHAR(45),
        password_changed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_admin_id UUID
      )
    `);

    // Create audit_logs table (immutable)
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_user_id UUID NOT NULL REFERENCES admin_users(id),
        action VARCHAR(50) NOT NULL,
        target_type VARCHAR(50),
        target_id UUID,
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ... (support_tickets, ticket_messages, feature_flags, content_flags)

    // Add account status columns to users
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN account_status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN suspended_until TIMESTAMP,
      ADD COLUMN suspension_reason VARCHAR(255);
    `);

    // Seed first super admin (only in production with manual password reset)
    // NOTE: Use environment variable for secure password
    const hashedPassword = await bcrypt.hash(process.env.FIRST_ADMIN_PASSWORD || 'CHANGE_ME', 10);
    await queryRunner.query(`
      INSERT INTO admin_users (email, password_hash, full_name, role, is_active, two_factor_enabled)
      VALUES ('admin@menumaker.app', '${hashedPassword}', 'Super Admin', 'super_admin', true, false);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE content_flags CASCADE`);
    await queryRunner.query(`DROP TABLE feature_flags CASCADE`);
    await queryRunner.query(`DROP TABLE ticket_messages CASCADE`);
    await queryRunner.query(`DROP TABLE support_tickets CASCADE`);
    await queryRunner.query(`DROP TABLE audit_logs CASCADE`);
    await queryRunner.query(`DROP TABLE admin_users CASCADE`);

    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN account_status,
      DROP COLUMN suspended_until,
      DROP COLUMN suspension_reason;
    `);
  }
}
```

**Downtime**: ✅ Zero (additive changes)

**Post-Migration**: Force first admin to change password on first login

---

## Cross-Phase Migration Strategy

### Phase 1 → Phase 2 Transition

**Timeline**: End of Month 2 (after MVP launch)

**Pre-Migration**:
1. ✅ Phase 2 code deployed to staging
2. ✅ Migrations tested with production-like data (500 users, 1000 orders)
3. ✅ Database backup created (`heroku pg:backups:capture`)

**Migration Steps**:
1. **Deploy Phase 2 migrations** (zero downtime)
   ```bash
   heroku run npm run migrate -a menumaker-api-production
   ```
2. **Verify migrations**: Check `typeorm_migrations` table
3. **Deploy Phase 2 code**: Gradual rollout (10% → 50% → 100%)
4. **Monitor errors**: Sentry error rate should remain <1%

**Rollback Plan**:
- Code rollback: `heroku releases:rollback v123`
- Database rollback: Migrations are additive, no rollback needed (new columns/tables unused by Phase 1 code)

**Estimated Downtime**: ✅ Zero

---

### Phase 2 → Phase 3 Transition

**Timeline**: End of Month 6 (after Growth phase)

**Pre-Migration**:
1. ✅ Phase 3 code deployed to staging
2. ✅ Migrations tested with 500 sellers, 10,000 orders
3. ✅ Database backup created

**Migration Steps**:
1. **Deploy Phase 3 migrations** (includes admin backend)
   ```bash
   heroku run npm run migrate -a menumaker-api-production
   ```
2. **Seed first admin user** (manual password reset required)
3. **Deploy Phase 3 code**
4. **Verify admin portal accessible** (`admin.menumaker.app`)

**Complex Migration**: `account_status` column requires backfill

```typescript
// Part of Phase3AddAdminBackend migration
public async up(queryRunner: QueryRunner): Promise<void> {
  // ... table creation ...

  // Backfill account_status for existing users
  await queryRunner.query(`
    UPDATE users
    SET account_status = 'active'
    WHERE account_status IS NULL;
  `);

  // Make column NOT NULL after backfill
  await queryRunner.query(`
    ALTER TABLE users
    ALTER COLUMN account_status SET NOT NULL;
  `);
}
```

**Estimated Downtime**: ⚠️ 5-10 minutes (for admin user setup)

---

## Rollback Procedures

### Automated Rollback (Migration Failed)

If migration fails during `npm run migrate`:

```bash
# TypeORM automatically rolls back failed migration
# No manual intervention needed

# Verify migration status
npm run migrate:show

# If migration partially applied, manually revert
npm run migrate:revert
```

### Manual Rollback (Production Incident)

If code deployment succeeded but migration causes issues:

```bash
# Step 1: Identify last successful migration
heroku run npm run migrate:show -a menumaker-api-production

# Step 2: Revert last migration
heroku run npm run migrate:revert -a menumaker-api-production

# Step 3: Rollback code to previous release
heroku releases:rollback v122 -a menumaker-api-production

# Step 4: Verify application health
curl https://menumaker.app/health
```

### Database Restore (Catastrophic Failure)

If migrations corrupted data:

```bash
# List available backups (7-day retention on Heroku Postgres Standard)
heroku pg:backups -a menumaker-api-production

# Restore from specific backup (DESTRUCTIVE!)
heroku pg:backups:restore b042 DATABASE_URL -a menumaker-api-production --confirm menumaker-api-production

# Re-run migrations from restored state
heroku run npm run migrate -a menumaker-api-production
```

**Recovery Time Objective (RTO)**: 30 minutes
**Recovery Point Objective (RPO)**: 24 hours (daily backups)

---

## Migration Testing Strategy

### Local Development Testing

```bash
# Step 1: Create fresh test database
createdb menumaker_migration_test

# Step 2: Run all migrations
DATABASE_URL=postgresql://localhost/menumaker_migration_test npm run migrate

# Step 3: Verify schema
psql menumaker_migration_test -c "\dt"  # List tables
psql menumaker_migration_test -c "\d users"  # Describe users table

# Step 4: Test rollback
DATABASE_URL=postgresql://localhost/menumaker_migration_test npm run migrate:revert

# Step 5: Verify rollback succeeded
psql menumaker_migration_test -c "\dt"
```

### Staging Environment Testing

**Before deploying to production**:

1. **Snapshot production database** (anonymize PII):
   ```bash
   heroku pg:backups:capture -a menumaker-api-production
   heroku pg:backups:download -a menumaker-api-production
   # Restore to staging (anonymize with script)
   heroku pg:backups:restore <backup-url> DATABASE_URL -a menumaker-api-staging
   ```

2. **Run migrations in staging**:
   ```bash
   heroku run npm run migrate -a menumaker-api-staging
   ```

3. **Run smoke tests**:
   ```bash
   npm run test:e2e:smoke -- --base-url=https://staging.menumaker.app
   ```

4. **Monitor for 24 hours**: Check error rates, query performance

---

## Performance Considerations

### Large Table Migrations

For tables with >100K rows (e.g., `orders` table in Phase 3):

**Slow Operations**:
- Adding NOT NULL columns without default (requires full table scan)
- Adding indexes on large tables (can take minutes)
- Changing column types (requires table rewrite)

**Optimization Strategies**:

```typescript
// Instead of:
await queryRunner.query(`
  ALTER TABLE orders ADD COLUMN new_field VARCHAR(255) NOT NULL;
`);

// Use:
await queryRunner.query(`
  ALTER TABLE orders ADD COLUMN new_field VARCHAR(255) DEFAULT '' NOT NULL;
`);
// Then backfill in batches
await queryRunner.query(`
  UPDATE orders SET new_field = 'default_value' WHERE new_field = '';
`);
```

**Index Creation (Zero Downtime)**:

```typescript
// Use CONCURRENTLY to avoid table locks
await queryRunner.query(`
  CREATE INDEX CONCURRENTLY idx_orders_business_created
  ON orders(business_id, created_at);
`);
```

---

## Migration Checklist

### Before Creating Migration

- [ ] Schema changes documented in data-model.md
- [ ] Migration naming follows convention
- [ ] Migration has both `up()` and `down()` methods
- [ ] Migration is idempotent (can be re-run safely)
- [ ] Foreign key constraints properly defined
- [ ] Indexes added for frequently queried columns
- [ ] Default values set for new columns (additive migrations)

### Before Deploying Migration

- [ ] Migration tested locally (fresh database)
- [ ] Migration tested in staging (production-like data)
- [ ] Rollback tested (`migrate:revert`)
- [ ] Database backup created
- [ ] Deployment window scheduled (off-peak hours)
- [ ] On-call engineer identified
- [ ] Downtime estimate communicated to team

### After Deploying Migration

- [ ] Migration applied successfully (check logs)
- [ ] Application health check passing
- [ ] Smoke tests passing
- [ ] No error spike in Sentry
- [ ] Database query performance normal
- [ ] Deployment logged in team wiki

---

## Future Enhancements (Phase 3.5+)

- **Blue-Green Migrations**: Run migrations on standby database, then switch
- **Online Schema Changes**: Use tools like `pg_repack` for zero-downtime column type changes
- **Multi-Region Migrations**: Coordinate migrations across geographically distributed databases
- **Migration Linting**: Automated checks for dangerous operations (e.g., adding NOT NULL without default)

---

## References

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Heroku Postgres Backups](https://devcenter.heroku.com/articles/heroku-postgres-backups)
- [Zero-Downtime Database Migrations](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)

---

**Status**: ✅ Ready for Implementation
**Owner**: Backend/Platform Team
**Last Updated**: 2025-11-14
