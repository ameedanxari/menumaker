import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Migration: Add Multiple Payment Processors Support
 * Phase 3 - US3.1: Multiple Payment Processors (Razorpay, PhonePe, Paytm)
 *
 * Creates:
 * - payment_processors table
 * - Updates payments table with multi-processor fields
 */
export class AddMultiplePaymentProcessors1763170000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create payment_processors table ==========
    await queryRunner.createTable(
      new Table({
        name: 'payment_processors',
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
            name: 'processor_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Processor type: stripe, razorpay, phonepe, paytm',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending_verification'",
            isNullable: false,
            comment: 'Processor status: active, inactive, pending_verification, failed',
          },
          {
            name: 'priority',
            type: 'integer',
            default: 999,
            isNullable: false,
            comment: 'Priority for automatic routing (lower = higher priority)',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'credentials',
            type: 'jsonb',
            isNullable: false,
            comment: 'Encrypted processor credentials (API keys, secrets)',
          },
          {
            name: 'settlement_schedule',
            type: 'varchar',
            length: '20',
            default: "'weekly'",
            isNullable: false,
            comment: 'Settlement schedule: daily, weekly, monthly',
          },
          {
            name: 'min_payout_threshold_cents',
            type: 'integer',
            default: 50000,
            isNullable: false,
            comment: 'Minimum payout threshold in cents (default: Rs. 500)',
          },
          {
            name: 'fee_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 2.0,
            isNullable: false,
            comment: 'Processor fee percentage',
          },
          {
            name: 'fixed_fee_cents',
            type: 'integer',
            default: 0,
            isNullable: false,
            comment: 'Fixed fee per transaction in cents',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Processor-specific metadata',
          },
          {
            name: 'last_transaction_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last successful transaction timestamp',
          },
          {
            name: 'verified_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Credentials verification timestamp',
          },
          {
            name: 'connection_error',
            type: 'text',
            isNullable: true,
            comment: 'Connection error details (if failed)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_payment_processors_business_id',
            columnNames: ['business_id'],
          },
          {
            name: 'IDX_payment_processors_type',
            columnNames: ['processor_type'],
          },
          {
            name: 'IDX_payment_processors_active',
            columnNames: ['is_active', 'status'],
          },
          {
            name: 'IDX_payment_processors_priority',
            columnNames: ['business_id', 'priority'],
          },
        ],
      }),
      true
    );

    // Add foreign key: business_id -> businesses.id
    await queryRunner.createForeignKey(
      'payment_processors',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Update payments table with multi-processor fields ==========

    // Add new columns for multi-processor support
    await queryRunner.addColumns('payments', [
      new TableColumn({
        name: 'payment_processor_id',
        type: 'uuid',
        isNullable: true,
        comment: 'Reference to payment_processors table',
      }),
      new TableColumn({
        name: 'processor_type',
        type: 'varchar',
        length: '50',
        isNullable: true,
        default: "'stripe'",
        comment: 'Processor type: stripe, razorpay, phonepe, paytm',
      }),
      new TableColumn({
        name: 'processor_payment_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Generic processor payment/order ID',
      }),
      new TableColumn({
        name: 'processor_charge_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Generic processor charge/transaction ID',
      }),
      new TableColumn({
        name: 'processor_fee_cents',
        type: 'integer',
        default: 0,
        isNullable: false,
        comment: 'Processor fee in cents',
      }),
      new TableColumn({
        name: 'net_amount_cents',
        type: 'integer',
        default: 0,
        isNullable: false,
        comment: 'Net amount after fees (amount_cents - processor_fee_cents)',
      }),
      new TableColumn({
        name: 'payment_method_details',
        type: 'jsonb',
        isNullable: true,
        comment: 'Payment method details (card last 4, UPI ID, etc.)',
      }),
      new TableColumn({
        name: 'refund_details',
        type: 'jsonb',
        isNullable: true,
        comment: 'Refund details (refund_id, amount, reason, timestamp)',
      }),
      new TableColumn({
        name: 'settlement_details',
        type: 'jsonb',
        isNullable: true,
        comment: 'Settlement/payout details (payout_id, settled_at, status)',
      }),
    ]);

    // Add index for processor_payment_id (for webhook lookups)
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_processor_payment_id"
      ON "payments" ("processor_payment_id")
      WHERE "processor_payment_id" IS NOT NULL
    `);

    // Add index for processor_type
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_processor_type"
      ON "payments" ("processor_type")
    `);

    // Add index for payment_processor_id
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_processor_id"
      ON "payments" ("payment_processor_id")
      WHERE "payment_processor_id" IS NOT NULL
    `);

    // Add foreign key: payment_processor_id -> payment_processors.id
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['payment_processor_id'],
        referencedTableName: 'payment_processors',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );

    // ========== Migrate existing Stripe payments ==========
    // Populate new fields for existing payments
    await queryRunner.query(`
      UPDATE payments
      SET
        processor_type = 'stripe',
        processor_payment_id = stripe_payment_intent_id,
        processor_charge_id = stripe_charge_id
      WHERE stripe_payment_intent_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const paymentsTable = await queryRunner.getTable('payments');
    const paymentProcessorFk = paymentsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('payment_processor_id') !== -1
    );
    if (paymentProcessorFk) {
      await queryRunner.dropForeignKey('payments', paymentProcessorFk);
    }

    // Drop indices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_processor_payment_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_processor_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_processor_id"`);

    // Drop new columns from payments
    await queryRunner.dropColumns('payments', [
      'payment_processor_id',
      'processor_type',
      'processor_payment_id',
      'processor_charge_id',
      'processor_fee_cents',
      'net_amount_cents',
      'payment_method_details',
      'refund_details',
      'settlement_details',
    ]);

    // Drop payment_processors table
    await queryRunner.dropTable('payment_processors');
  }
}
