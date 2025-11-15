import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Admin Moderation Fields to Users and Businesses
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Adds suspension, ban, and moderation fields to existing tables
 */
export class AddAdminModerationFields1763160001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add suspension and ban fields to users table
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "suspended_until" timestamp,
        ADD COLUMN "suspension_reason" text,
        ADD COLUMN "is_banned" boolean NOT NULL DEFAULT false,
        ADD COLUMN "ban_reason" text,
        ADD COLUMN "banned_at" timestamp;

      COMMENT ON COLUMN "users"."suspended_until" IS 'If set, user is suspended until this date';
      COMMENT ON COLUMN "users"."suspension_reason" IS 'Reason for suspension';
      COMMENT ON COLUMN "users"."is_banned" IS 'Permanent ban flag';
      COMMENT ON COLUMN "users"."ban_reason" IS 'Reason for ban';
      COMMENT ON COLUMN "users"."banned_at" IS 'When user was banned';
    `);

    // Add moderation fields to businesses table
    await queryRunner.query(`
      ALTER TABLE "businesses"
        ADD COLUMN "is_published" boolean NOT NULL DEFAULT true,
        ADD COLUMN "deleted_at" timestamp;

      COMMENT ON COLUMN "businesses"."is_published" IS 'Can be set to false by admin (suspension)';
      COMMENT ON COLUMN "businesses"."deleted_at" IS 'Soft delete timestamp (when user is banned)';
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "idx_users_suspended_until" ON "users" ("suspended_until");
      CREATE INDEX "idx_users_is_banned" ON "users" ("is_banned");
      CREATE INDEX "idx_businesses_is_published" ON "businesses" ("is_published");
      CREATE INDEX "idx_businesses_deleted_at" ON "businesses" ("deleted_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_businesses_deleted_at";
      DROP INDEX IF EXISTS "idx_businesses_is_published";
      DROP INDEX IF EXISTS "idx_users_is_banned";
      DROP INDEX IF EXISTS "idx_users_suspended_until";
    `);

    // Remove columns from businesses
    await queryRunner.query(`
      ALTER TABLE "businesses"
        DROP COLUMN "deleted_at",
        DROP COLUMN "is_published";
    `);

    // Remove columns from users
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "banned_at",
        DROP COLUMN "ban_reason",
        DROP COLUMN "is_banned",
        DROP COLUMN "suspension_reason",
        DROP COLUMN "suspended_until";
    `);
  }
}
