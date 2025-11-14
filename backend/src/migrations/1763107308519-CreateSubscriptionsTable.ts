import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSubscriptionsTable1763107308519 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'tier',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'free'",
            comment: 'free, starter, pro',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'active'",
            comment: 'active, canceled, past_due, trialing, incomplete',
          },
          {
            name: 'stripe_customer_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Stripe customer ID (cus_xxx)',
          },
          {
            name: 'stripe_subscription_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: true,
            comment: 'Stripe subscription ID (sub_xxx)',
          },
          {
            name: 'stripe_price_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Stripe price ID for the current tier',
          },
          {
            name: 'current_period_start',
            type: 'timestamp',
            isNullable: true,
            comment: 'Start of current billing period',
          },
          {
            name: 'current_period_end',
            type: 'timestamp',
            isNullable: true,
            comment: 'End of current billing period',
          },
          {
            name: 'cancel_at_period_end',
            type: 'boolean',
            default: false,
            comment: 'Whether subscription will cancel at period end',
          },
          {
            name: 'canceled_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When subscription was canceled',
          },
          {
            name: 'trial_start',
            type: 'timestamp',
            isNullable: true,
            comment: 'Start of trial period',
          },
          {
            name: 'trial_end',
            type: 'timestamp',
            isNullable: true,
            comment: 'End of trial period',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional subscription metadata',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Add foreign key to businesses table
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'businesses',
        onDelete: 'CASCADE',
      })
    );

    // Create unique constraint on business_id (one subscription per business)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_subscriptions_business_id_unique ON subscriptions(business_id);
    `);

    // Create index on tier for filtering
    await queryRunner.query(`
      CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
    `);

    // Create index on status for filtering
    await queryRunner.query(`
      CREATE INDEX idx_subscriptions_status ON subscriptions(status);
    `);

    // Create index on stripe_customer_id for lookups
    await queryRunner.query(`
      CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
    `);

    // Create index on current_period_end for billing cycle queries
    await queryRunner.query(`
      CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
    `);

    // Create default free subscriptions for existing businesses
    await queryRunner.query(`
      INSERT INTO subscriptions (business_id, tier, status)
      SELECT id, 'free', 'active'
      FROM businesses
      WHERE NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE subscriptions.business_id = businesses.id
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_current_period_end;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_stripe_customer_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_tier;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_business_id_unique;`);

    // Drop foreign key
    const subscriptionsTable = await queryRunner.getTable('subscriptions');
    if (subscriptionsTable) {
      const businessForeignKey = subscriptionsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('business_id') !== -1
      );
      if (businessForeignKey) {
        await queryRunner.dropForeignKey('subscriptions', businessForeignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('subscriptions');
  }
}
