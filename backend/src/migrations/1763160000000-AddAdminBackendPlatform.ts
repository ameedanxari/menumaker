import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Admin Backend Platform (Phase 3 - US3.10)
 *
 * Creates tables for:
 * - admin_users: Platform administrators with RBAC
 * - audit_logs: Immutable logs of all admin actions
 * - support_tickets: Customer support ticket system
 * - feature_flags: Feature toggles and gradual rollouts
 * - content_flags: Content moderation and reporting
 */
export class AddAdminBackendPlatform1763160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create admin_users table
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) UNIQUE NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(100),
        "role" varchar(50) NOT NULL DEFAULT 'support_agent',
        "two_factor_enabled" boolean NOT NULL DEFAULT false,
        "two_factor_secret" varchar(32),
        "last_login_ip" varchar(45),
        "last_login_at" timestamp,
        "whitelisted_ips" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX "idx_admin_users_email" ON "admin_users" ("email");
      CREATE INDEX "idx_admin_users_role" ON "admin_users" ("role");

      COMMENT ON TABLE "admin_users" IS 'Platform administrators with role-based access control';
      COMMENT ON COLUMN "admin_users"."role" IS 'super_admin, moderator, or support_agent';
      COMMENT ON COLUMN "admin_users"."two_factor_enabled" IS 'Mandatory for all admin users';
      COMMENT ON COLUMN "admin_users"."whitelisted_ips" IS 'Optional IP whitelist (comma-separated)';
    `);

    // 2. Create audit_logs table (immutable, append-only)
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "admin_user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
        "action" varchar(50) NOT NULL,
        "target_type" varchar(50),
        "target_id" uuid,
        "details" jsonb,
        "ip_address" varchar(45) NOT NULL,
        "user_agent" varchar(255),
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX "idx_audit_logs_admin_user_created" ON "audit_logs" ("admin_user_id", "created_at");
      CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
      CREATE INDEX "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id");

      COMMENT ON TABLE "audit_logs" IS 'Immutable audit trail of all admin actions (1-year retention)';
      COMMENT ON COLUMN "audit_logs"."action" IS 'ban_user, suspend_user, approve_flag, toggle_feature_flag, etc.';
      COMMENT ON COLUMN "audit_logs"."details" IS 'JSON metadata (reason, duration, previous/new values)';
    `);

    // 3. Create support_tickets table
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "assigned_to_id" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
        "subject" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'open',
        "priority" varchar(50) NOT NULL DEFAULT 'medium',
        "category" varchar(50),
        "conversation" jsonb,
        "internal_notes" text,
        "tags" text,
        "first_response_at" timestamp,
        "resolved_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX "idx_support_tickets_user_status" ON "support_tickets" ("user_id", "status");
      CREATE INDEX "idx_support_tickets_assigned_to" ON "support_tickets" ("assigned_to_id");
      CREATE INDEX "idx_support_tickets_status_priority" ON "support_tickets" ("status", "priority");
      CREATE INDEX "idx_support_tickets_created" ON "support_tickets" ("created_at");

      COMMENT ON TABLE "support_tickets" IS 'Customer support ticket system with SLA tracking';
      COMMENT ON COLUMN "support_tickets"."status" IS 'open, pending, resolved, or closed';
      COMMENT ON COLUMN "support_tickets"."priority" IS 'low, medium, or high';
      COMMENT ON COLUMN "support_tickets"."conversation" IS 'JSON array of messages (user/admin)';
      COMMENT ON COLUMN "support_tickets"."first_response_at" IS 'SLA metric: 24-hour target';
    `);

    // 4. Create feature_flags table
    await queryRunner.query(`
      CREATE TABLE "feature_flags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "flag_key" varchar(100) UNIQUE NOT NULL,
        "display_name" varchar(200) NOT NULL,
        "description" text,
        "is_enabled" boolean NOT NULL DEFAULT false,
        "rollout_percentage" integer NOT NULL DEFAULT 100,
        "tier_overrides" jsonb,
        "whitelisted_user_ids" text,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX "idx_feature_flags_key" ON "feature_flags" ("flag_key");
      CREATE INDEX "idx_feature_flags_enabled" ON "feature_flags" ("is_enabled");

      COMMENT ON TABLE "feature_flags" IS 'Feature toggles for gradual rollouts and A/B testing';
      COMMENT ON COLUMN "feature_flags"."flag_key" IS 'Unique identifier (e.g., whatsapp_automation_enabled)';
      COMMENT ON COLUMN "feature_flags"."rollout_percentage" IS '0-100: percentage of users to enable for';
      COMMENT ON COLUMN "feature_flags"."tier_overrides" IS 'JSON: { free: false, pro: true, business: true }';

      -- Insert default feature flags for Phase 2-3 features
      INSERT INTO "feature_flags" ("flag_key", "display_name", "description", "is_enabled", "rollout_percentage") VALUES
        ('whatsapp_automation_enabled', 'WhatsApp Automation', 'Enable WhatsApp notifications for orders (Phase 2.3)', true, 100),
        ('ocr_import_enabled', 'OCR Menu Import', 'Enable AI-powered OCR menu import (Phase 2.4)', true, 100),
        ('referral_system_enabled', 'Referral System', 'Enable seller-to-seller referral program (Phase 2.5)', true, 100),
        ('gdpr_compliance_enabled', 'GDPR Compliance', 'Enable GDPR cookie consent and data deletion (Phase 2.6)', true, 100),
        ('reorder_flow_enabled', 'Customer Re-order Flow', 'Enable previous order history and quick re-order (Phase 2.7)', true, 100),
        ('marketplace_discovery_enabled', 'Marketplace Discovery', 'Enable public seller marketplace (Phase 3.6)', false, 0),
        ('referral_leaderboard_enabled', 'Referral Leaderboard', 'Enable referral leaderboard and prizes (Phase 3.11)', false, 0);
    `);

    // 5. Create content_flags table
    await queryRunner.query(`
      CREATE TABLE "content_flags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "flag_type" varchar(50) NOT NULL,
        "target_id" uuid NOT NULL,
        "reason" varchar(50) NOT NULL,
        "description" text,
        "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "auto_hidden" boolean NOT NULL DEFAULT false,
        "reviewed_by_id" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
        "reviewed_at" timestamp,
        "moderator_notes" text,
        "action_taken" varchar(50),
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX "idx_content_flags_target" ON "content_flags" ("flag_type", "target_id");
      CREATE INDEX "idx_content_flags_reporter" ON "content_flags" ("reporter_id");
      CREATE INDEX "idx_content_flags_status" ON "content_flags" ("status");
      CREATE INDEX "idx_content_flags_created" ON "content_flags" ("created_at");

      COMMENT ON TABLE "content_flags" IS 'Content moderation: user-reported offensive/inappropriate content';
      COMMENT ON COLUMN "content_flags"."flag_type" IS 'review, dish, image, profile, or menu';
      COMMENT ON COLUMN "content_flags"."reason" IS 'spam, offensive, inappropriate, harassment, fraud, or other';
      COMMENT ON COLUMN "content_flags"."auto_hidden" IS 'True if auto-hidden after 3+ flags';
      COMMENT ON COLUMN "content_flags"."action_taken" IS 'content_hidden, content_deleted, user_warned, user_suspended, user_banned, no_action';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "content_flags";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_users";`);
  }
}
