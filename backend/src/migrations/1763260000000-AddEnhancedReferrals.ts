import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Add Enhanced Referral & Viral Features
 * Phase 3 - US3.11: Enhanced Referral & Viral Features
 *
 * Updates:
 * - Create customer_referrals table (customer-to-customer referrals)
 * - Create referral_leaderboard table (monthly leaderboard tracking)
 * - Create affiliates table (influencer affiliate program)
 * - Create affiliate_clicks table (click tracking)
 * - Create affiliate_payouts table (commission payouts)
 * - Create viral_badges table (achievement badges)
 */
export class AddEnhancedReferrals1763260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create customer_referrals table ==========

    await queryRunner.createTable(
      new Table({
        name: 'customer_referrals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'referral_code',
            type: 'varchar',
            length: '20',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'referrer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'referee_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'referee_order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'link_clicked'",
          },
          {
            name: 'reward_value_cents',
            type: 'integer',
            default: 10000,
          },
          {
            name: 'referrer_reward_claimed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'referee_reward_claimed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'reward_claimed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'clicked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'order_placed_at',
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
            name: 'IDX_customer_referrals_code',
            columnNames: ['referral_code'],
          },
          {
            name: 'IDX_customer_referrals_referrer_status',
            columnNames: ['referrer_id', 'status'],
          },
          {
            name: 'IDX_customer_referrals_referee',
            columnNames: ['referee_id'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'customer_referrals',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'customer_referrals',
      new TableForeignKey({
        columnNames: ['referrer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create referral_leaderboard table ==========

    await queryRunner.createTable(
      new Table({
        name: 'referral_leaderboard',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'month',
            type: 'varchar',
            length: '7',
            isNullable: false,
          },
          {
            name: 'successful_referrals',
            type: 'integer',
            default: 0,
          },
          {
            name: 'rank',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'prize_amount_cents',
            type: 'integer',
            default: 0,
          },
          {
            name: 'prize_paid',
            type: 'boolean',
            default: false,
          },
          {
            name: 'prize_paid_at',
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
            name: 'IDX_leaderboard_month_referrals',
            columnNames: ['month', 'successful_referrals'],
          },
          {
            name: 'IDX_leaderboard_user_month',
            columnNames: ['user_id', 'month'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'referral_leaderboard',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create affiliates table ==========

    await queryRunner.createTable(
      new Table({
        name: 'affiliates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'affiliate_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'affiliate_type',
            type: 'varchar',
            length: '50',
            default: "'influencer'",
          },
          {
            name: 'application_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'instagram_handle',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'instagram_followers',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'youtube_channel',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'youtube_subscribers',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'seller_commission_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 5.0,
          },
          {
            name: 'customer_commission_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 2.0,
          },
          {
            name: 'seller_commission_months',
            type: 'integer',
            default: 6,
          },
          {
            name: 'customer_commission_months',
            type: 'integer',
            default: 3,
          },
          {
            name: 'min_payout_cents',
            type: 'integer',
            default: 100000,
          },
          {
            name: 'payout_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'payout_details',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'total_clicks',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_signups',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_conversions',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_gmv_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'total_commission_earned_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'total_commission_paid_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'pending_commission_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'approved_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'qr_code_data',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'social_media_templates',
            type: 'text',
            isNullable: false,
            default: "''",
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
            name: 'IDX_affiliates_code',
            columnNames: ['affiliate_code'],
          },
          {
            name: 'IDX_affiliates_user',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_affiliates_status',
            columnNames: ['status'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'affiliates',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create affiliate_clicks table ==========

    await queryRunner.createTable(
      new Table({
        name: 'affiliate_clicks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'affiliate_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'referrer_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'utm_source',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'utm_medium',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'utm_campaign',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'converted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'converted_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'converted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_affiliate_clicks_affiliate_created',
            columnNames: ['affiliate_id', 'created_at'],
          },
          {
            name: 'IDX_affiliate_clicks_ip',
            columnNames: ['ip_address'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'affiliate_clicks',
      new TableForeignKey({
        columnNames: ['affiliate_id'],
        referencedTableName: 'affiliates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create affiliate_payouts table ==========

    await queryRunner.createTable(
      new Table({
        name: 'affiliate_payouts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'affiliate_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'payout_month',
            type: 'varchar',
            length: '7',
            isNullable: false,
          },
          {
            name: 'payout_amount_cents',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'seller_referrals_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'seller_gmv_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'seller_commission_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'customer_referrals_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'customer_gmv_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'customer_commission_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'payout_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'transaction_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'paid_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failure_reason',
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
            name: 'IDX_affiliate_payouts_affiliate_status',
            columnNames: ['affiliate_id', 'status'],
          },
          {
            name: 'IDX_affiliate_payouts_month',
            columnNames: ['payout_month'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'affiliate_payouts',
      new TableForeignKey({
        columnNames: ['affiliate_id'],
        referencedTableName: 'affiliates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create viral_badges table ==========

    await queryRunner.createTable(
      new Table({
        name: 'viral_badges',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'badge_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'tier',
            type: 'integer',
            default: 1,
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'icon_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'referrals_required',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'referrals_achieved',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'benefits',
            type: 'text',
            isNullable: false,
            default: "''",
          },
          {
            name: 'awarded_at',
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
            name: 'IDX_viral_badges_user_type',
            columnNames: ['user_id', 'badge_type'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'viral_badges',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('viral_badges');
    await queryRunner.dropTable('affiliate_payouts');
    await queryRunner.dropTable('affiliate_clicks');
    await queryRunner.dropTable('affiliates');
    await queryRunner.dropTable('referral_leaderboard');
    await queryRunner.dropTable('customer_referrals');
  }
}
