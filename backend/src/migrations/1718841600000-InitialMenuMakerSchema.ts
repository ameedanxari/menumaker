import { MigrationInterface, QueryRunner } from 'typeorm';

type Column = {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  default?: string;
};

const timestampColumns: Column[] = [
  { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
  { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
];

const idColumn: Column = {
  name: 'id',
  type: 'uuid',
  primary: true,
  default: 'uuid_generate_v4()',
};

const tables: Array<{ name: string; columns: Column[]; indexes?: string[]; uniques?: string[] }> = [
  { name: 'users', columns: [idColumn, { name: 'email', type: 'varchar', unique: true }, { name: 'name', type: 'varchar' }, ...timestampColumns], indexes: ['email'] },
  { name: 'admin_users', columns: [idColumn, { name: 'email', type: 'varchar', unique: true }, { name: 'role', type: 'varchar', default: "'admin'" }, ...timestampColumns] },
  { name: 'businesses', columns: [idColumn, { name: 'owner_id', type: 'uuid' }, { name: 'name', type: 'varchar' }, { name: 'slug', type: 'varchar', unique: true }, ...timestampColumns], indexes: ['owner_id', 'slug'] },
  { name: 'business_settings', columns: [idColumn, { name: 'business_id', type: 'uuid', unique: true }, { name: 'currency', type: 'varchar(3)', default: "'INR'" }, { name: 'min_order_value_cents', type: 'integer', default: '0' }, ...timestampColumns] },
  { name: 'dish_categories', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'name', type: 'varchar' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'common_dishes', columns: [idColumn, { name: 'name', type: 'varchar' }, { name: 'category', type: 'varchar', nullable: true }, ...timestampColumns] },
  { name: 'dishes', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'name', type: 'varchar' }, { name: 'price_cents', type: 'integer', default: '0' }, { name: 'is_available', type: 'boolean', default: 'true' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'menus', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'name', type: 'varchar' }, { name: 'is_published', type: 'boolean', default: 'false' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'menu_items', columns: [idColumn, { name: 'menu_id', type: 'uuid' }, { name: 'dish_id', type: 'uuid' }, { name: 'sort_order', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['menu_id', 'dish_id'] },
  { name: 'saved_carts', columns: [idColumn, { name: 'customer_id', type: 'uuid' }, { name: 'business_id', type: 'uuid' }, { name: 'items', type: 'jsonb', default: "'[]'::jsonb" }, ...timestampColumns], indexes: ['customer_id', 'business_id'] },
  { name: 'orders', columns: [idColumn, { name: 'customer_id', type: 'uuid' }, { name: 'business_id', type: 'uuid' }, { name: 'status', type: 'varchar', default: "'pending'" }, { name: 'total_cents', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['customer_id', 'business_id', 'status'] },
  { name: 'order_items', columns: [idColumn, { name: 'order_id', type: 'uuid' }, { name: 'dish_id', type: 'uuid', nullable: true }, { name: 'quantity', type: 'integer', default: '1' }, { name: 'price_at_purchase_cents', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['order_id'] },
  { name: 'order_notifications', columns: [idColumn, { name: 'order_id', type: 'uuid' }, { name: 'type', type: 'varchar' }, { name: 'sent_at', type: 'timestamptz', nullable: true }, ...timestampColumns], indexes: ['order_id'] },
  { name: 'payment_processors', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'provider', type: 'varchar' }, { name: 'is_active', type: 'boolean', default: 'true' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'payments', columns: [idColumn, { name: 'order_id', type: 'uuid', nullable: true }, { name: 'business_id', type: 'uuid', nullable: true }, { name: 'amount_cents', type: 'integer', default: '0' }, { name: 'currency', type: 'varchar(3)', default: "'INR'" }, { name: 'status', type: 'varchar', default: "'pending'" }, { name: 'processor_type', type: 'varchar', nullable: true }, { name: 'processor_payment_id', type: 'varchar', nullable: true }, { name: 'metadata', type: 'jsonb', nullable: true }, ...timestampColumns], indexes: ['order_id', 'business_id', 'status'] },
  { name: 'subscriptions', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'status', type: 'varchar', default: "'active'" }, ...timestampColumns], indexes: ['business_id', 'status'] },
  { name: 'payouts', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'amount_cents', type: 'integer', default: '0' }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['business_id', 'status'] },
  { name: 'payout_schedules', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'frequency', type: 'varchar', default: "'weekly'" }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'tax_invoices', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'order_id', type: 'uuid', nullable: true }, { name: 'invoice_number', type: 'varchar', unique: true }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'tax_reports', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'period', type: 'varchar' }, { name: 'payload', type: 'jsonb', default: "'{}'::jsonb" }, ...timestampColumns], indexes: ['business_id', 'period'] },
  { name: 'referrals', columns: [idColumn, { name: 'referrer_id', type: 'uuid' }, { name: 'referee_id', type: 'uuid', nullable: true }, { name: 'code', type: 'varchar', unique: true }, ...timestampColumns], indexes: ['referrer_id'] },
  { name: 'cookie_consents', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'version', type: 'varchar' }, { name: 'accepted_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' }, ...timestampColumns], indexes: ['user_id'] },
  { name: 'legal_templates', columns: [idColumn, { name: 'template_key', type: 'varchar', unique: true }, { name: 'version', type: 'varchar' }, { name: 'content', type: 'text' }, ...timestampColumns] },
  { name: 'deletion_requests', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['user_id', 'status'] },
  { name: 'support_tickets', columns: [idColumn, { name: 'user_id', type: 'uuid', nullable: true }, { name: 'status', type: 'varchar', default: "'open'" }, { name: 'subject', type: 'varchar' }, ...timestampColumns], indexes: ['status'] },
  { name: 'feature_flags', columns: [idColumn, { name: 'flag_key', type: 'varchar', unique: true }, { name: 'enabled', type: 'boolean', default: 'false' }, ...timestampColumns] },
  { name: 'content_flags', columns: [idColumn, { name: 'target_type', type: 'varchar' }, { name: 'target_id', type: 'uuid' }, { name: 'reporter_id', type: 'uuid' }, { name: 'status', type: 'varchar', default: "'pending'" }, { name: 'reason', type: 'text' }, { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' }], indexes: ['target_type,target_id', 'reporter_id', 'status', 'created_at'] },
  { name: 'audit_logs', columns: [idColumn, { name: 'actor_id', type: 'uuid', nullable: true }, { name: 'action', type: 'varchar' }, { name: 'metadata', type: 'jsonb', default: "'{}'::jsonb" }, { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' }], indexes: ['actor_id', 'action'] },
  { name: 'reviews', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'customer_id', type: 'uuid' }, { name: 'order_id', type: 'uuid', nullable: true }, { name: 'rating', type: 'integer' }, { name: 'review_text', type: 'text', nullable: true }, { name: 'status', type: 'varchar', default: "'pending'" }, { name: 'is_public', type: 'boolean', default: 'false' }, ...timestampColumns], indexes: ['business_id', 'customer_id', 'order_id', 'status'] },
  { name: 'review_helpful', columns: [idColumn, { name: 'review_id', type: 'uuid' }, { name: 'user_id', type: 'uuid' }, ...timestampColumns], indexes: ['review_id', 'user_id'] },
  { name: 'marketplace_settings', columns: [idColumn, { name: 'business_id', type: 'uuid', unique: true }, { name: 'is_discoverable', type: 'boolean', default: 'false' }, { name: 'is_featured', type: 'boolean', default: 'false' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'marketplace_analytics', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'date', type: 'date' }, { name: 'profile_views', type: 'integer', default: '0' }, { name: 'menu_clicks', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['business_id,date'] },
  { name: 'customer_favorites', columns: [idColumn, { name: 'customer_id', type: 'uuid' }, { name: 'business_id', type: 'uuid' }, ...timestampColumns], indexes: ['customer_id,business_id'] },
  { name: 'notification_devices', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'token', type: 'text' }, { name: 'platform', type: 'varchar' }, ...timestampColumns], indexes: ['user_id'] },
  { name: 'notifications', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'type', type: 'varchar' }, { name: 'payload', type: 'jsonb', default: "'{}'::jsonb" }, { name: 'read_at', type: 'timestamptz', nullable: true }, ...timestampColumns], indexes: ['user_id'] },
  { name: 'pos_integrations', columns: [idColumn, { name: 'business_id', type: 'uuid', unique: true }, { name: 'provider', type: 'varchar' }, { name: 'is_active', type: 'boolean', default: 'true' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'pos_sync_logs', columns: [idColumn, { name: 'pos_integration_id', type: 'uuid' }, { name: 'order_id', type: 'uuid' }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['pos_integration_id,created_at', 'order_id'] },
  { name: 'delivery_integrations', columns: [idColumn, { name: 'business_id', type: 'uuid', unique: true }, { name: 'provider', type: 'varchar' }, { name: 'is_active', type: 'boolean', default: 'true' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'delivery_tracking', columns: [idColumn, { name: 'delivery_integration_id', type: 'uuid' }, { name: 'order_id', type: 'uuid', unique: true }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['order_id'] },
  { name: 'delivery_ratings', columns: [idColumn, { name: 'delivery_tracking_id', type: 'uuid' }, { name: 'rating', type: 'integer' }, ...timestampColumns], indexes: ['delivery_tracking_id'] },
  { name: 'coupons', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'code', type: 'varchar', unique: true }, { name: 'status', type: 'varchar', default: "'active'" }, { name: 'min_order_value_cents', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['business_id,status'] },
  { name: 'coupon_usages', columns: [idColumn, { name: 'coupon_id', type: 'uuid' }, { name: 'customer_id', type: 'uuid' }, { name: 'order_id', type: 'uuid', unique: true }, ...timestampColumns], indexes: ['coupon_id,customer_id', 'order_id'] },
  { name: 'automatic_promotions', columns: [idColumn, { name: 'business_id', type: 'uuid' }, { name: 'name', type: 'varchar' }, { name: 'is_active', type: 'boolean', default: 'true' }, ...timestampColumns], indexes: ['business_id'] },
  { name: 'customer_referrals', columns: [idColumn, { name: 'referral_code', type: 'varchar', unique: true }, { name: 'referrer_id', type: 'uuid' }, { name: 'referee_id', type: 'uuid', nullable: true }, { name: 'status', type: 'varchar', default: "'link_clicked'" }, ...timestampColumns], indexes: ['referrer_id,status', 'referee_id'] },
  { name: 'referral_leaderboard', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'month', type: 'varchar' }, { name: 'successful_referrals', type: 'integer', default: '0' }, ...timestampColumns], indexes: ['month,successful_referrals', 'user_id,month'] },
  { name: 'affiliates', columns: [idColumn, { name: 'user_id', type: 'uuid', unique: true }, { name: 'affiliate_code', type: 'varchar', unique: true }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['user_id', 'status'] },
  { name: 'affiliate_clicks', columns: [idColumn, { name: 'affiliate_id', type: 'uuid' }, { name: 'clicked_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' }, ...timestampColumns], indexes: ['affiliate_id'] },
  { name: 'affiliate_payouts', columns: [idColumn, { name: 'affiliate_id', type: 'uuid' }, { name: 'amount_cents', type: 'integer', default: '0' }, { name: 'status', type: 'varchar', default: "'pending'" }, ...timestampColumns], indexes: ['affiliate_id'] },
  { name: 'viral_badges', columns: [idColumn, { name: 'user_id', type: 'uuid' }, { name: 'badge_key', type: 'varchar' }, ...timestampColumns], indexes: ['user_id'] },
];

const foreignKeys: Array<{ table: string; column: string; references: string }> = [
  { table: 'businesses', column: 'owner_id', references: 'users(id)' },
  { table: 'business_settings', column: 'business_id', references: 'businesses(id)' },
  { table: 'menus', column: 'business_id', references: 'businesses(id)' },
  { table: 'dishes', column: 'business_id', references: 'businesses(id)' },
  { table: 'orders', column: 'customer_id', references: 'users(id)' },
  { table: 'orders', column: 'business_id', references: 'businesses(id)' },
  { table: 'order_items', column: 'order_id', references: 'orders(id)' },
  { table: 'payments', column: 'order_id', references: 'orders(id)' },
  { table: 'payments', column: 'business_id', references: 'businesses(id)' },
];

export class InitialMenuMakerSchema1718841600000 implements MigrationInterface {
  name = 'InitialMenuMakerSchema1718841600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    for (const table of tables) {
      const columns = table.columns.map((column) => {
        const parts = [`"${column.name}"`, column.type];
        if (column.primary) parts.push('PRIMARY KEY');
        if (!column.nullable && !column.primary) parts.push('NOT NULL');
        if (column.unique) parts.push('UNIQUE');
        if (column.default) parts.push(`DEFAULT ${column.default}`);
        return parts.join(' ');
      });
      await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')})`);
    }

    for (const fk of foreignKeys) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${fk.table}_${fk.column}_fk'
          ) THEN
            ALTER TABLE "${fk.table}"
              ADD CONSTRAINT "${fk.table}_${fk.column}_fk"
              FOREIGN KEY ("${fk.column}") REFERENCES ${fk.references}
              ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    }

    for (const table of tables) {
      for (const index of table.indexes ?? []) {
        const columns = index.split(',').map((column) => `"${column.trim()}"`).join(', ');
        const indexName = `${table.name}_${index.replace(/[^a-zA-Z0-9]+/g, '_')}_idx`;
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table.name}" (${columns})`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...tables].reverse()) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table.name}" CASCADE`);
    }
  }
}
