import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Add Re-order Flow (Phase 2.7)
 *
 * Creates:
 * 1. saved_carts table
 */
export class AddReorderFlow1763150000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create saved_carts table
    await queryRunner.createTable(
      new Table({
        name: 'saved_carts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_phone',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'customer_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'customer_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cart_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'cart_items',
            type: 'text',
          },
          {
            name: 'total_cents',
            type: 'integer',
          },
          {
            name: 'times_used',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Add indexes
    await queryRunner.createIndex(
      'saved_carts',
      new TableIndex({
        name: 'IDX_SAVED_CARTS_PHONE',
        columnNames: ['customer_phone'],
      })
    );

    await queryRunner.createIndex(
      'saved_carts',
      new TableIndex({
        name: 'IDX_SAVED_CARTS_EMAIL',
        columnNames: ['customer_email'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('saved_carts', 'IDX_SAVED_CARTS_EMAIL');
    await queryRunner.dropIndex('saved_carts', 'IDX_SAVED_CARTS_PHONE');

    // Drop table
    await queryRunner.dropTable('saved_carts');
  }
}
