import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWhatsAppSettings1763120000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add WhatsApp settings to business_settings table
    await queryRunner.addColumns('business_settings', [
      new TableColumn({
        name: 'whatsapp_enabled',
        type: 'boolean',
        default: false,
        comment: 'Enable WhatsApp notifications for this business',
      }),
      new TableColumn({
        name: 'whatsapp_phone_number',
        type: 'varchar',
        length: '20',
        isNullable: true,
        comment: 'Business WhatsApp number (E.164 format)',
      }),
      new TableColumn({
        name: 'whatsapp_notify_new_order',
        type: 'boolean',
        default: true,
        comment: 'Send WhatsApp notification on new order',
      }),
      new TableColumn({
        name: 'whatsapp_notify_order_update',
        type: 'boolean',
        default: true,
        comment: 'Send WhatsApp notification on order status change',
      }),
      new TableColumn({
        name: 'whatsapp_notify_payment',
        type: 'boolean',
        default: true,
        comment: 'Send WhatsApp notification on payment received',
      }),
      new TableColumn({
        name: 'whatsapp_customer_notifications',
        type: 'boolean',
        default: false,
        comment: 'Send WhatsApp notifications to customers',
      }),
    ]);

    // Create index for WhatsApp-enabled businesses
    await queryRunner.query(`
      CREATE INDEX idx_business_settings_whatsapp_enabled
      ON business_settings(whatsapp_enabled)
      WHERE whatsapp_enabled = true;
    `);

    console.log('✅ Added WhatsApp settings columns to business_settings table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_business_settings_whatsapp_enabled'
    );

    // Remove WhatsApp columns
    await queryRunner.dropColumns('business_settings', [
      'whatsapp_enabled',
      'whatsapp_phone_number',
      'whatsapp_notify_new_order',
      'whatsapp_notify_order_update',
      'whatsapp_notify_payment',
      'whatsapp_customer_notifications',
    ]);

    console.log('✅ Removed WhatsApp settings columns from business_settings table');
  }
}
