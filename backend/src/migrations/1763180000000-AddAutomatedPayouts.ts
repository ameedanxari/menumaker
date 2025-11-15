import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add Automated Tiered Payouts
 * Phase 3 - US3.2: Automated Tiered Payouts & Payout Scheduling
 *
 * Updates:
 * - Enhance payouts table with scheduling, fees, volume discounts
 * - Create payout_schedules table for automated payout configuration
 */
export class AddAutomatedPayouts1763180000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Enhance payouts table ==========

    await queryRunner.addColumns('payouts', [
      // Payment processor reference
      new TableColumn({
        name: 'payment_processor_id',
        type: 'uuid',
        isNullable: true,
      }),
      // Scheduling
      new TableColumn({
        name: 'scheduled_payout_date',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'frequency',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      // Fee breakdown
      new TableColumn({
        name: 'processor_fee_cents',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'subscription_fee_cents',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'volume_discount_cents',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'payment_count',
        type: 'integer',
        default: 0,
      }),
      // Processing
      new TableColumn({
        name: 'processor_payout_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bank_transaction_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'failure_reason',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'retry_count',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'next_retry_date',
        type: 'date',
        isNullable: true,
      }),
      // Reconciliation
      new TableColumn({
        name: 'reconciliation_status',
        type: 'varchar',
        length: '20',
        default: "'pending'",
      }),
      new TableColumn({
        name: 'reconciliation_details',
        type: 'jsonb',
        isNullable: true,
      }),
      // Tax
      new TableColumn({
        name: 'taxable_amount_cents',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'tds_cents',
        type: 'integer',
        default: 0,
      }),
      // Metadata
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp',
        default: 'NOW()',
      }),
      new TableColumn({
        name: 'failed_at',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);

    // Update status column to support new statuses
    await queryRunner.query(`
      ALTER TABLE "payouts"
      ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "payouts"
      ALTER COLUMN "status" TYPE varchar(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "payouts"
      ALTER COLUMN "status" SET DEFAULT 'pending'
    `);

    // Add indexes
    await queryRunner.createIndex(
      'payouts',
      new TableIndex({
        name: 'IDX_payouts_processor_id',
        columnNames: ['payment_processor_id'],
      })
    );

    await queryRunner.createIndex(
      'payouts',
      new TableIndex({
        name: 'IDX_payouts_scheduled_date_status',
        columnNames: ['scheduled_payout_date', 'status'],
      })
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'payouts',
      new TableForeignKey({
        columnNames: ['payment_processor_id'],
        referencedTableName: 'payment_processors',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );

    // ========== Create payout_schedules table ==========

    await queryRunner.createTable(
      new Table({
        name: 'payout_schedules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'payment_processor_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'frequency',
            type: 'varchar',
            length: '20',
            default: "'weekly'",
          },
          {
            name: 'weekly_day_of_week',
            type: 'integer',
            default: 1,
            isNullable: true,
          },
          {
            name: 'monthly_day_of_month',
            type: 'integer',
            default: 1,
            isNullable: true,
          },
          {
            name: 'min_payout_threshold_cents',
            type: 'integer',
            default: 50000,
          },
          {
            name: 'max_hold_period_days',
            type: 'integer',
            default: 7,
          },
          {
            name: 'is_manually_held',
            type: 'boolean',
            default: false,
          },
          {
            name: 'hold_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'hold_start_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'current_balance_cents',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_payout_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_payout_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'email_notifications_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notification_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'current_month_gmv_cents',
            type: 'integer',
            default: 0,
          },
          {
            name: 'gmv_month',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'volume_discount_eligible',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_payout_schedules_business_processor',
            columnNames: ['business_id', 'payment_processor_id'],
            isUnique: true,
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'payout_schedules',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'payout_schedules',
      new TableForeignKey({
        columnNames: ['payment_processor_id'],
        referencedTableName: 'payment_processors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop payout_schedules table
    await queryRunner.dropTable('payout_schedules');

    // Drop new columns from payouts
    await queryRunner.dropColumns('payouts', [
      'payment_processor_id',
      'scheduled_payout_date',
      'frequency',
      'processor_fee_cents',
      'subscription_fee_cents',
      'volume_discount_cents',
      'payment_count',
      'processor_payout_id',
      'bank_transaction_id',
      'failure_reason',
      'retry_count',
      'next_retry_date',
      'reconciliation_status',
      'reconciliation_details',
      'taxable_amount_cents',
      'tds_cents',
      'metadata',
      'updated_at',
      'failed_at',
    ]);

    // Drop indexes
    await queryRunner.dropIndex('payouts', 'IDX_payouts_processor_id');
    await queryRunner.dropIndex('payouts', 'IDX_payouts_scheduled_date_status');

    // Restore old status type
    await queryRunner.query(`
      ALTER TABLE "payouts"
      ALTER COLUMN "status" TYPE varchar
    `);
  }
}
