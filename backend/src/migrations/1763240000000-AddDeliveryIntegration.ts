import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Add Delivery Partner Integration
 * Phase 3 - US3.8: Delivery Partner Integration (Swiggy, Zomato, Dunzo)
 *
 * Updates:
 * - Create delivery_integrations table (delivery partner settings)
 * - Create delivery_tracking table (order delivery status tracking)
 * - Create delivery_ratings table (separate delivery ratings)
 */
export class AddDeliveryIntegration1763240000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create delivery_integrations table ==========

    await queryRunner.createTable(
      new Table({
        name: 'delivery_integrations',
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
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Delivery provider: swiggy, zomato, dunzo',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'api_key',
            type: 'text',
            isNullable: true,
            comment: 'API key for delivery partner',
          },
          {
            name: 'api_secret',
            type: 'text',
            isNullable: true,
            comment: 'API secret for delivery partner',
          },
          {
            name: 'partner_account_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Partner account/merchant ID',
          },
          {
            name: 'cost_handling',
            type: 'varchar',
            length: '20',
            default: "'customer'",
            comment: 'customer or seller',
          },
          {
            name: 'fixed_delivery_fee_cents',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'auto_assign_delivery',
            type: 'boolean',
            default: true,
          },
          {
            name: 'pickup_instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'webhook_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'last_delivery_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'total_deliveries',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failure_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: true,
            comment: 'Provider-specific settings',
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
            name: 'IDX_delivery_integrations_business_id',
            columnNames: ['business_id'],
          },
          {
            name: 'IDX_delivery_integrations_is_active',
            columnNames: ['is_active'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'delivery_integrations',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create delivery_tracking table ==========

    await queryRunner.createTable(
      new Table({
        name: 'delivery_tracking',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'delivery_integration_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            comment: 'pending, assigned, picked_up, en_route, delivered, cancelled, failed',
          },
          {
            name: 'delivery_partner_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Delivery partner order/task ID',
          },
          {
            name: 'delivery_person_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'delivery_person_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'estimated_pickup_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'picked_up_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'estimated_delivery_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'delivered_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'delivery_fee_cents',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'tracking_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'delivery_instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cancellation_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'attempt_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'delivery_otp',
            type: 'varchar',
            length: '6',
            isNullable: true,
          },
          {
            name: 'status_history',
            type: 'jsonb',
            isNullable: true,
            comment: 'Array of status updates with timestamps',
          },
          {
            name: 'error_message',
            type: 'text',
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
            name: 'IDX_delivery_tracking_order_id',
            columnNames: ['order_id'],
          },
          {
            name: 'IDX_delivery_tracking_partner_id',
            columnNames: ['delivery_partner_id'],
          },
          {
            name: 'IDX_delivery_tracking_status',
            columnNames: ['status'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'delivery_tracking',
      new TableForeignKey({
        columnNames: ['delivery_integration_id'],
        referencedTableName: 'delivery_integrations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'delivery_tracking',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create delivery_ratings table ==========

    await queryRunner.createTable(
      new Table({
        name: 'delivery_ratings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'delivery_tracking_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'rating',
            type: 'integer',
            isNullable: false,
            comment: 'Delivery rating 1-5',
          },
          {
            name: 'feedback',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'timeliness_rating',
            type: 'integer',
            isNullable: true,
            comment: '1-5',
          },
          {
            name: 'courtesy_rating',
            type: 'integer',
            isNullable: true,
            comment: '1-5',
          },
          {
            name: 'packaging_rating',
            type: 'integer',
            isNullable: true,
            comment: '1-5',
          },
          {
            name: 'issues',
            type: 'text',
            isNullable: false,
            default: "''",
            comment: 'Comma-separated list of issues',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_delivery_ratings_order_id',
            columnNames: ['order_id'],
          },
          {
            name: 'IDX_delivery_ratings_tracking_id',
            columnNames: ['delivery_tracking_id'],
          },
          {
            name: 'IDX_delivery_ratings_customer_id',
            columnNames: ['customer_id'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'delivery_ratings',
      new TableForeignKey({
        columnNames: ['delivery_tracking_id'],
        referencedTableName: 'delivery_tracking',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'delivery_ratings',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'delivery_ratings',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop delivery_ratings table
    await queryRunner.dropTable('delivery_ratings');

    // Drop delivery_tracking table
    await queryRunner.dropTable('delivery_tracking');

    // Drop delivery_integrations table
    await queryRunner.dropTable('delivery_integrations');
  }
}
