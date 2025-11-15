import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add GDPR Foundation (Phase 2.6)
 *
 * Creates:
 * 1. cookie_consents table
 * 2. deletion_requests table
 * 3. legal_templates table
 */
export class AddGDPRFoundation1763140000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create cookie_consents table
    await queryRunner.createTable(
      new Table({
        name: 'cookie_consents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'visitor_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'essential',
            type: 'boolean',
            default: true,
          },
          {
            name: 'analytics',
            type: 'boolean',
            default: false,
          },
          {
            name: 'marketing',
            type: 'boolean',
            default: false,
          },
          {
            name: 'consent_method',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'en'",
          },
          {
            name: 'expires_at',
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

    // 2. Create deletion_requests table
    await queryRunner.createTable(
      new Table({
        name: 'deletion_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'user_email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scheduled_deletion_date',
            type: 'timestamp',
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'admin_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'admin_notes',
            type: 'text',
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

    // 3. Create legal_templates table
    await queryRunner.createTable(
      new Table({
        name: 'legal_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'template_type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'jurisdiction',
            type: 'varchar',
            length: '10',
            default: "'IN'",
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'customizations',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
            default: "'1.0'",
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'published_at',
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

    // Add foreign keys
    await queryRunner.createForeignKey(
      'deletion_requests',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'legal_templates',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // Add indexes
    await queryRunner.createIndex(
      'cookie_consents',
      new TableIndex({
        name: 'IDX_COOKIE_CONSENTS_VISITOR',
        columnNames: ['visitor_id'],
      })
    );

    await queryRunner.createIndex(
      'cookie_consents',
      new TableIndex({
        name: 'IDX_COOKIE_CONSENTS_IP',
        columnNames: ['ip_address'],
      })
    );

    await queryRunner.createIndex(
      'deletion_requests',
      new TableIndex({
        name: 'IDX_DELETION_REQUESTS_USER',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'deletion_requests',
      new TableIndex({
        name: 'IDX_DELETION_REQUESTS_STATUS',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'deletion_requests',
      new TableIndex({
        name: 'IDX_DELETION_REQUESTS_SCHEDULED_DATE',
        columnNames: ['scheduled_deletion_date'],
      })
    );

    await queryRunner.createIndex(
      'legal_templates',
      new TableIndex({
        name: 'IDX_LEGAL_TEMPLATES_BUSINESS_TYPE',
        columnNames: ['business_id', 'template_type'],
      })
    );

    await queryRunner.createIndex(
      'legal_templates',
      new TableIndex({
        name: 'IDX_LEGAL_TEMPLATES_JURISDICTION',
        columnNames: ['jurisdiction'],
      })
    );

    await queryRunner.createIndex(
      'legal_templates',
      new TableIndex({
        name: 'IDX_LEGAL_TEMPLATES_PUBLISHED',
        columnNames: ['is_published'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('legal_templates', 'IDX_LEGAL_TEMPLATES_PUBLISHED');
    await queryRunner.dropIndex('legal_templates', 'IDX_LEGAL_TEMPLATES_JURISDICTION');
    await queryRunner.dropIndex('legal_templates', 'IDX_LEGAL_TEMPLATES_BUSINESS_TYPE');
    await queryRunner.dropIndex('deletion_requests', 'IDX_DELETION_REQUESTS_SCHEDULED_DATE');
    await queryRunner.dropIndex('deletion_requests', 'IDX_DELETION_REQUESTS_STATUS');
    await queryRunner.dropIndex('deletion_requests', 'IDX_DELETION_REQUESTS_USER');
    await queryRunner.dropIndex('cookie_consents', 'IDX_COOKIE_CONSENTS_IP');
    await queryRunner.dropIndex('cookie_consents', 'IDX_COOKIE_CONSENTS_VISITOR');

    // Drop tables (foreign keys auto-dropped)
    await queryRunner.dropTable('legal_templates');
    await queryRunner.dropTable('deletion_requests');
    await queryRunner.dropTable('cookie_consents');
  }
}
