import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add Reviews & Complaint Workflow
 * Phase 3 - US3.5: Review & Complaint Workflow
 *
 * Updates:
 * - Create reviews table with moderation workflow
 * - Create review_responses table for seller replies
 * - Add indexes for performance
 */
export class AddReviewsAndComplaintWorkflow1763210000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create reviews table ==========

    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
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
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          // Review content
          {
            name: 'rating',
            type: 'integer',
            isNullable: false,
            comment: 'Rating from 1 to 5 stars',
          },
          {
            name: 'review_text',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'photo_urls',
            type: 'text',
            default: "''",
            comment: 'Comma-separated photo URLs (max 3)',
          },
          // Moderation
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            comment: 'pending, approved, rejected, removed',
          },
          {
            name: 'is_complaint',
            type: 'boolean',
            default: false,
            comment: 'True if rating < 3',
          },
          {
            name: 'complaint_status',
            type: 'varchar',
            length: '20',
            isNullable: true,
            comment: 'open, in_progress, resolved, escalated',
          },
          {
            name: 'auto_approve_at',
            type: 'timestamp',
            isNullable: true,
            comment: '24 hours from creation',
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'seller_notified_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When seller was notified about complaint',
          },
          // Seller response
          {
            name: 'has_seller_response',
            type: 'boolean',
            default: false,
          },
          // Display
          {
            name: 'is_public',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_verified_purchase',
            type: 'boolean',
            default: true,
          },
          {
            name: 'helpful_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'report_count',
            type: 'integer',
            default: 0,
            comment: 'Reported as spam/offensive count',
          },
          {
            name: 'customer_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Cached customer name for display',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'order_total_cents, delivery_time, seller_rejection_reason, admin_notes',
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
            name: 'IDX_reviews_business_status',
            columnNames: ['business_id', 'status'],
          },
          {
            name: 'IDX_reviews_order_id',
            columnNames: ['order_id'],
            isUnique: true,
          },
          {
            name: 'IDX_reviews_customer_business_created',
            columnNames: ['customer_id', 'business_id', 'created_at'],
          },
          {
            name: 'IDX_reviews_auto_approve',
            columnNames: ['auto_approve_at'],
          },
          {
            name: 'IDX_reviews_is_public',
            columnNames: ['is_public'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Create review_responses table ==========

    await queryRunner.createTable(
      new Table({
        name: 'review_responses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'review_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'response_text',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'responder_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Business owner name',
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: true,
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
            name: 'IDX_review_responses_review_id',
            columnNames: ['review_id'],
          },
          {
            name: 'IDX_review_responses_business_id',
            columnNames: ['business_id'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'review_responses',
      new TableForeignKey({
        columnNames: ['review_id'],
        referencedTableName: 'reviews',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'review_responses',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop review_responses table
    await queryRunner.dropTable('review_responses');

    // Drop reviews table
    await queryRunner.dropTable('reviews');
  }
}
