import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Add Coupons & Promotions
 * Phase 3 - US3.9: Promotions, Coupons & Discounts
 *
 * Updates:
 * - Create coupons table (discount coupons with rules)
 * - Create coupon_usages table (coupon redemption tracking)
 * - Create automatic_promotions table (automatic promotion rules)
 */
export class AddCouponsPromotions1763250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create coupons table ==========

    await queryRunner.createTable(
      new Table({
        name: 'coupons',
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
            name: 'code',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'discount_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'fixed or percentage',
          },
          {
            name: 'discount_value',
            type: 'integer',
            isNullable: false,
            comment: 'Amount in cents (fixed) or percentage value',
          },
          {
            name: 'max_discount_cents',
            type: 'integer',
            isNullable: true,
            comment: 'Max discount for percentage coupons',
          },
          {
            name: 'min_order_value_cents',
            type: 'integer',
            default: 0,
          },
          {
            name: 'valid_from',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'usage_limit_type',
            type: 'varchar',
            length: '20',
            default: "'unlimited'",
            comment: 'per_customer, per_month, unlimited, total_limit',
          },
          {
            name: 'usage_limit_per_customer',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'usage_limit_per_month',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'total_usage_limit',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'total_usage_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'applicable_to',
            type: 'varchar',
            length: '20',
            default: "'all_dishes'",
            comment: 'all_dishes or specific_dishes',
          },
          {
            name: 'dish_ids',
            type: 'text',
            isNullable: false,
            default: "''",
            comment: 'Comma-separated dish IDs',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
            comment: 'active, expired, archived',
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: true,
          },
          {
            name: 'qr_code_data',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'total_discount_given_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'total_revenue_generated_cents',
            type: 'bigint',
            default: 0,
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
            name: 'IDX_coupons_business_status',
            columnNames: ['business_id', 'status'],
          },
          {
            name: 'IDX_coupons_code',
            columnNames: ['code'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'coupons',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create coupon_usages table ==========

    await queryRunner.createTable(
      new Table({
        name: 'coupon_usages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'coupon_id',
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
            name: 'coupon_code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'discount_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'discount_value',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'discount_amount_cents',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'order_subtotal_cents',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'order_total_cents',
            type: 'integer',
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
            name: 'IDX_coupon_usages_coupon_customer',
            columnNames: ['coupon_id', 'customer_id'],
          },
          {
            name: 'IDX_coupon_usages_order',
            columnNames: ['order_id'],
          },
          {
            name: 'IDX_coupon_usages_created',
            columnNames: ['created_at'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'coupon_usages',
      new TableForeignKey({
        columnNames: ['coupon_id'],
        referencedTableName: 'coupons',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'coupon_usages',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'coupon_usages',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create automatic_promotions table ==========

    await queryRunner.createTable(
      new Table({
        name: 'automatic_promotions',
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
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'free_delivery, discount, free_item',
          },
          {
            name: 'min_order_value_cents',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'discount_value',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'discount_type',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'free_dish_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'valid_from',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: true,
          },
          {
            name: 'total_applications',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_discount_given_cents',
            type: 'bigint',
            default: 0,
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
            name: 'IDX_automatic_promotions_business_active',
            columnNames: ['business_id', 'is_active'],
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'automatic_promotions',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop automatic_promotions table
    await queryRunner.dropTable('automatic_promotions');

    // Drop coupon_usages table
    await queryRunner.dropTable('coupon_usages');

    // Drop coupons table
    await queryRunner.dropTable('coupons');
  }
}
