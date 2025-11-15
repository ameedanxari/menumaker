import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add Marketplace & Seller Discovery
 * Phase 3 - US3.6: Marketplace & Seller Discovery
 *
 * Updates:
 * - Create marketplace_settings table (seller opt-in, cuisine, location)
 * - Create marketplace_analytics table (impressions, conversions)
 * - Create customer_favorites table (saved sellers)
 */
export class AddMarketplaceDiscovery1763220000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create marketplace_settings table ==========

    await queryRunner.createTable(
      new Table({
        name: 'marketplace_settings',
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
            name: 'is_discoverable',
            type: 'boolean',
            default: false,
            comment: 'Opt-in for marketplace discovery',
          },
          {
            name: 'cuisine_types',
            type: 'text',
            default: "''",
            comment: 'Comma-separated cuisine types (Indian, Chinese, etc.)',
          },
          {
            name: 'is_featured',
            type: 'boolean',
            default: false,
            comment: 'Editorial/admin featured status',
          },
          {
            name: 'featured_priority',
            type: 'integer',
            default: 999,
            comment: 'Featured priority (lower = higher)',
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'state',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'country',
            type: 'varchar',
            length: '100',
            default: "'India'",
          },
          {
            name: 'show_exact_location',
            type: 'boolean',
            default: false,
            comment: 'Show exact address vs city-level',
          },
          {
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'longitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'business_hours',
            type: 'jsonb',
            isNullable: true,
            comment: 'Business hours per day of week',
          },
          {
            name: 'contact_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'contact_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'short_description',
            type: 'varchar',
            length: '200',
            isNullable: true,
            comment: 'Short description for marketplace listing',
          },
          {
            name: 'tags',
            type: 'text',
            default: "''",
            comment: 'Comma-separated search tags',
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
            name: 'IDX_marketplace_settings_is_discoverable',
            columnNames: ['is_discoverable'],
          },
          {
            name: 'IDX_marketplace_settings_is_featured',
            columnNames: ['is_featured'],
          },
          {
            name: 'IDX_marketplace_settings_city',
            columnNames: ['city'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'marketplace_settings',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create marketplace_analytics table ==========

    await queryRunner.createTable(
      new Table({
        name: 'marketplace_analytics',
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
            name: 'date',
            type: 'date',
            isNullable: false,
            comment: 'Analytics for specific date',
          },
          {
            name: 'profile_views',
            type: 'integer',
            default: 0,
            comment: 'Marketplace impressions (profile views)',
          },
          {
            name: 'menu_clicks',
            type: 'integer',
            default: 0,
            comment: 'Marketplace clicks (menu views)',
          },
          {
            name: 'marketplace_orders',
            type: 'integer',
            default: 0,
            comment: 'Orders from marketplace',
          },
          {
            name: 'conversion_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            comment: 'Conversion rate (orders / profile_views * 100)',
          },
          {
            name: 'search_appearances',
            type: 'integer',
            default: 0,
            comment: 'Times appeared in search results',
          },
          {
            name: 'favorites_added',
            type: 'integer',
            default: 0,
            comment: 'Times added to favorites',
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
            name: 'IDX_marketplace_analytics_business_date',
            columnNames: ['business_id', 'date'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'marketplace_analytics',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create customer_favorites table ==========

    await queryRunner.createTable(
      new Table({
        name: 'customer_favorites',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'varchar',
            length: '200',
            isNullable: true,
            comment: 'Customer notes about this favorite',
          },
          {
            name: 'last_order_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last order date (for sorting)',
          },
          {
            name: 'order_count',
            type: 'integer',
            default: 0,
            comment: 'Total orders from this seller',
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
            name: 'IDX_customer_favorites_customer_business',
            columnNames: ['customer_id', 'business_id'],
            isUnique: true,
          },
          {
            name: 'IDX_customer_favorites_customer',
            columnNames: ['customer_id'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'customer_favorites',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'customer_favorites',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop customer_favorites table
    await queryRunner.dropTable('customer_favorites');

    // Drop marketplace_analytics table
    await queryRunner.dropTable('marketplace_analytics');

    // Drop marketplace_settings table
    await queryRunner.dropTable('marketplace_settings');
  }
}
