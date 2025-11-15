import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add POS System Integration & Order Sync
 * Phase 3 - US3.7: POS System Integration & Order Sync
 *
 * Updates:
 * - Create pos_integrations table (OAuth credentials, settings)
 * - Create pos_sync_logs table (sync history with retry logic)
 */
export class AddPOSIntegration1763230000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create pos_integrations table ==========

    await queryRunner.createTable(
      new Table({
        name: 'pos_integrations',
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
            comment: 'POS provider: square, dine, zoho',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'access_token',
            type: 'text',
            isNullable: false,
            comment: 'OAuth access token (encrypted)',
          },
          {
            name: 'refresh_token',
            type: 'text',
            isNullable: true,
            comment: 'OAuth refresh token (encrypted)',
          },
          {
            name: 'token_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'location_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'POS location/outlet ID',
          },
          {
            name: 'merchant_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'POS merchant/account ID',
          },
          {
            name: 'auto_sync_orders',
            type: 'boolean',
            default: true,
          },
          {
            name: 'sync_customer_info',
            type: 'boolean',
            default: true,
          },
          {
            name: 'item_mapping',
            type: 'jsonb',
            isNullable: true,
            comment: 'MenuMaker dish ID → POS item ID mapping',
          },
          {
            name: 'last_sync_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_count',
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
            name: 'IDX_pos_integrations_business_id',
            columnNames: ['business_id'],
          },
          {
            name: 'IDX_pos_integrations_is_active',
            columnNames: ['is_active'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'pos_integrations',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create pos_sync_logs table ==========

    await queryRunner.createTable(
      new Table({
        name: 'pos_sync_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'pos_integration_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            comment: 'pending, syncing, success, failed, retry',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'pos_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'POS system order/transaction ID',
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 12,
            comment: '12 retries = 1 hour with 5-min intervals',
          },
          {
            name: 'next_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'http_status',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'request_payload',
            type: 'jsonb',
            isNullable: true,
            comment: 'Request sent to POS',
          },
          {
            name: 'response_data',
            type: 'jsonb',
            isNullable: true,
            comment: 'Response from POS',
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
            comment: 'Sync duration in milliseconds',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
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
            name: 'IDX_pos_sync_logs_integration_created',
            columnNames: ['pos_integration_id', 'created_at'],
          },
          {
            name: 'IDX_pos_sync_logs_order_id',
            columnNames: ['order_id'],
          },
          {
            name: 'IDX_pos_sync_logs_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_pos_sync_logs_next_retry',
            columnNames: ['next_retry_at'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'pos_sync_logs',
      new TableForeignKey({
        columnNames: ['pos_integration_id'],
        referencedTableName: 'pos_integrations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'pos_sync_logs',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop pos_sync_logs table
    await queryRunner.dropTable('pos_sync_logs');

    // Drop pos_integrations table
    await queryRunner.dropTable('pos_integrations');
  }
}
