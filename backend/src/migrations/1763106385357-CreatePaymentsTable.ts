import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreatePaymentsTable1763106385357 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payments table
    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stripe_payment_intent_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'stripe_charge_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'amount_cents',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'INR'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'pending, succeeded, failed, canceled, refunded',
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'card, upi, netbanking, etc',
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional Stripe metadata',
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

    // Add foreign key to orders table
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      })
    );

    // Add foreign key to businesses table
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'businesses',
        onDelete: 'CASCADE',
      })
    );

    // Create index on order_id for faster lookups
    await queryRunner.query(`
      CREATE INDEX idx_payments_order_id ON payments(order_id);
    `);

    // Create index on business_id for reporting
    await queryRunner.query(`
      CREATE INDEX idx_payments_business_id ON payments(business_id);
    `);

    // Create index on status for filtering
    await queryRunner.query(`
      CREATE INDEX idx_payments_status ON payments(status);
    `);

    // Create index on created_at for time-based queries
    await queryRunner.query(`
      CREATE INDEX idx_payments_created_at ON payments(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_business_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_order_id;`);

    // Drop foreign keys
    const paymentsTable = await queryRunner.getTable('payments');
    if (paymentsTable) {
      const businessForeignKey = paymentsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('business_id') !== -1
      );
      if (businessForeignKey) {
        await queryRunner.dropForeignKey('payments', businessForeignKey);
      }

      const orderForeignKey = paymentsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('order_id') !== -1
      );
      if (orderForeignKey) {
        await queryRunner.dropForeignKey('payments', orderForeignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('payments');
  }
}
