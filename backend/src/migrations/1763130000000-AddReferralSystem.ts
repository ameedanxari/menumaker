import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add Referral System (Phase 2.5)
 *
 * Creates:
 * 1. referrals table
 * 2. User table extensions (referral_code, account_credit_cents, pro_tier_expires_at, referred_by_code)
 */
export class AddReferralSystem1763130000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create referrals table
    await queryRunner.createTable(
      new Table({
        name: 'referrals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'referral_code',
            type: 'varchar',
            length: '12',
            isUnique: true,
          },
          {
            name: 'referrer_id',
            type: 'uuid',
          },
          {
            name: 'referee_id',
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
            name: 'referee_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'referee_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'reward_type',
            type: 'varchar',
            length: '50',
            default: "'free_pro_month'",
          },
          {
            name: 'reward_value_cents',
            type: 'integer',
            default: 29900,
          },
          {
            name: 'reward_claimed',
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
            name: 'utm_source',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'click_ip',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'device_fingerprint',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'clicked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'signup_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'first_menu_published_at',
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

    // 2. Add foreign keys for referrals
    await queryRunner.createForeignKey(
      'referrals',
      new TableForeignKey({
        columnNames: ['referrer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'referrals',
      new TableForeignKey({
        columnNames: ['referee_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // 3. Add indexes for performance
    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_REFERRALS_REFERRAL_CODE',
        columnNames: ['referral_code'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_REFERRALS_REFERRER_STATUS',
        columnNames: ['referrer_id', 'status'],
      })
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_REFERRALS_REFEREE',
        columnNames: ['referee_id'],
      })
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_REFERRALS_CREATED_AT',
        columnNames: ['created_at'],
      })
    );

    // 4. Add referral fields to users table
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'referral_code',
        type: 'varchar',
        length: '12',
        isNullable: true,
        isUnique: true,
      }),
      new TableColumn({
        name: 'account_credit_cents',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'pro_tier_expires_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'referred_by_code',
        type: 'varchar',
        length: '12',
        isNullable: true,
      }),
    ]);

    // 5. Add index for user referral_code lookup
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_REFERRAL_CODE',
        columnNames: ['referral_code'],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop user indexes
    await queryRunner.dropIndex('users', 'IDX_USERS_REFERRAL_CODE');

    // Drop user columns
    await queryRunner.dropColumns('users', [
      'referral_code',
      'account_credit_cents',
      'pro_tier_expires_at',
      'referred_by_code',
    ]);

    // Drop referrals indexes
    await queryRunner.dropIndex('referrals', 'IDX_REFERRALS_CREATED_AT');
    await queryRunner.dropIndex('referrals', 'IDX_REFERRALS_REFEREE');
    await queryRunner.dropIndex('referrals', 'IDX_REFERRALS_REFERRER_STATUS');
    await queryRunner.dropIndex('referrals', 'IDX_REFERRALS_REFERRAL_CODE');

    // Drop referrals table (foreign keys auto-dropped)
    await queryRunner.dropTable('referrals');
  }
}
