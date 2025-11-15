import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add Tax Compliance & Reporting
 * Phase 3 - US3.4: Advanced Reporting & Tax Compliance
 *
 * Updates:
 * - Create tax_invoices table for GST invoice storage
 * - Add GSTIN and invoice numbering to business_settings
 */
export class AddTaxCompliance1763190000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Create tax_invoices table ==========

    await queryRunner.createTable(
      new Table({
        name: 'tax_invoices',
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
            name: 'invoice_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'invoice_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'financial_year',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'customer_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'customer_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'customer_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'customer_gstin',
            type: 'varchar',
            length: '15',
            isNullable: true,
          },
          {
            name: 'seller_gstin',
            type: 'varchar',
            length: '15',
            isNullable: true,
          },
          {
            name: 'seller_business_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'seller_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'subtotal_cents',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'gst_breakdown',
            type: 'jsonb',
            isNullable: false,
            comment: 'Array of {rate, taxable_amount_cents, gst_amount_cents, hsn_sac_code}',
          },
          {
            name: 'total_gst_cents',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_cents',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'line_items',
            type: 'jsonb',
            isNullable: false,
            comment: 'Array of {description, hsn_sac_code, quantity, unit_price_cents, gst_rate, gst_amount_cents, total_cents}',
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'pdf_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional data like terms_and_conditions, bank_details, etc.',
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
            name: 'IDX_tax_invoices_order_id',
            columnNames: ['order_id'],
            isUnique: true,
          },
          {
            name: 'IDX_tax_invoices_business_id',
            columnNames: ['business_id'],
          },
          {
            name: 'IDX_tax_invoices_invoice_number',
            columnNames: ['business_id', 'invoice_number'],
            isUnique: true,
          },
          {
            name: 'IDX_tax_invoices_date',
            columnNames: ['invoice_date'],
          },
          {
            name: 'IDX_tax_invoices_financial_year',
            columnNames: ['financial_year'],
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'tax_invoices',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'tax_invoices',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // ========== Enhance business_settings with tax compliance fields ==========

    await queryRunner.addColumns('business_settings', [
      // GSTIN (Goods and Services Tax Identification Number)
      new TableColumn({
        name: 'gstin',
        type: 'varchar',
        length: '15',
        isNullable: true,
        comment: 'GSTIN: 15-character alphanumeric (e.g., 22AAAAA0000A1Z5)',
      }),
      new TableColumn({
        name: 'is_gst_registered',
        type: 'boolean',
        default: false,
      }),
      // Legal business details for invoices
      new TableColumn({
        name: 'legal_business_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Legal registered business name for tax invoices',
      }),
      new TableColumn({
        name: 'business_address',
        type: 'text',
        isNullable: true,
        comment: 'Complete business address for invoices',
      }),
      // Invoice numbering
      new TableColumn({
        name: 'invoice_prefix',
        type: 'varchar',
        length: '10',
        default: "'INV'",
        comment: 'Invoice number prefix (e.g., INV, BILL)',
      }),
      new TableColumn({
        name: 'next_invoice_number',
        type: 'integer',
        default: 1,
        comment: 'Auto-incrementing invoice number',
      }),
      // Bank details for invoice display
      new TableColumn({
        name: 'bank_details',
        type: 'jsonb',
        isNullable: true,
        comment: 'Bank account details: {account_name, account_number, ifsc_code, bank_name}',
      }),
      // Invoice terms and conditions
      new TableColumn({
        name: 'invoice_terms',
        type: 'text',
        isNullable: true,
        comment: 'Terms and conditions to display on invoices',
      }),
    ]);

    // Add index on GSTIN
    await queryRunner.createIndex(
      'business_settings',
      new TableIndex({
        name: 'IDX_business_settings_gstin',
        columnNames: ['gstin'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tax_invoices table
    await queryRunner.dropTable('tax_invoices');

    // Drop business_settings columns
    await queryRunner.dropColumns('business_settings', [
      'gstin',
      'is_gst_registered',
      'legal_business_name',
      'business_address',
      'invoice_prefix',
      'next_invoice_number',
      'bank_details',
      'invoice_terms',
    ]);

    // Drop index
    await queryRunner.dropIndex('business_settings', 'IDX_business_settings_gstin');
  }
}
