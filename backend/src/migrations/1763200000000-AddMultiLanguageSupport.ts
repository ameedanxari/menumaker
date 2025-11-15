import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add Multi-Language Support & RTL Layout
 * Phase 3 - US3.3: Multi-Language Support & Internationalization
 *
 * Updates:
 * - Add translation fields to dishes (name_translations, description_translations)
 * - Add translation fields to dish_categories (name_translations, description_translations)
 * - Add i18n configuration to business_settings (default_locale, supported_locales, rtl_enabled, etc.)
 */
export class AddMultiLanguageSupport1763200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Add translation fields to dishes ==========

    await queryRunner.addColumns('dishes', [
      new TableColumn({
        name: 'name_translations',
        type: 'jsonb',
        isNullable: true,
        comment: 'Translations for dish name: { "hi": "पनीर बटर मसाला", "ta": "பனீர் பட்டர் மசாலா" }',
      }),
      new TableColumn({
        name: 'description_translations',
        type: 'jsonb',
        isNullable: true,
        comment: 'Translations for dish description: { "hi": "स्वादिष्ट पनीर करी", "ta": "சுவையான பனீர் கறி" }',
      }),
    ]);

    // ========== Add translation fields to dish_categories ==========

    await queryRunner.addColumns('dish_categories', [
      new TableColumn({
        name: 'name_translations',
        type: 'jsonb',
        isNullable: true,
        comment: 'Translations for category name: { "hi": "मुख्य व्यंजन", "ta": "முக்கிய உணவுகள்" }',
      }),
      new TableColumn({
        name: 'description_translations',
        type: 'jsonb',
        isNullable: true,
        comment: 'Translations for category description: { "hi": "हमारे प्रमुख व्यंजन", "ta": "எங்கள் பிரதான உணவுகள்" }',
      }),
    ]);

    // ========== Add i18n configuration to business_settings ==========

    await queryRunner.addColumns('business_settings', [
      // Locale configuration
      new TableColumn({
        name: 'default_locale',
        type: 'varchar',
        length: '5',
        default: "'en'",
        comment: 'Default locale for seller UI and public menu (en, hi, ta, ar)',
      }),
      new TableColumn({
        name: 'supported_locales',
        type: 'text',
        default: "'en'",
        comment: 'Comma-separated list of enabled locales for public menu',
      }),
      new TableColumn({
        name: 'rtl_enabled',
        type: 'boolean',
        default: false,
        comment: 'Enable RTL (Right-to-Left) layout for Arabic/Hebrew',
      }),
      // Date/time formatting
      new TableColumn({
        name: 'date_format',
        type: 'varchar',
        length: '20',
        default: "'DD/MM/YYYY'",
        comment: 'Date format preference (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)',
      }),
      new TableColumn({
        name: 'time_format',
        type: 'varchar',
        length: '5',
        default: "'24h'",
        comment: 'Time format preference (12h or 24h)',
      }),
      // Currency display
      new TableColumn({
        name: 'currency_display',
        type: 'varchar',
        length: '10',
        default: "'symbol'",
        comment: 'Currency display format (symbol: ₹, code: INR, name: Rupees)',
      }),
    ]);

    // Add index on default_locale for faster queries
    await queryRunner.createIndex(
      'business_settings',
      new TableIndex({
        name: 'IDX_business_settings_default_locale',
        columnNames: ['default_locale'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop dishes translation columns
    await queryRunner.dropColumns('dishes', ['name_translations', 'description_translations']);

    // Drop dish_categories translation columns
    await queryRunner.dropColumns('dish_categories', [
      'name_translations',
      'description_translations',
    ]);

    // Drop business_settings i18n columns
    await queryRunner.dropColumns('business_settings', [
      'default_locale',
      'supported_locales',
      'rtl_enabled',
      'date_format',
      'time_format',
      'currency_display',
    ]);

    // Drop index
    await queryRunner.dropIndex('business_settings', 'IDX_business_settings_default_locale');
  }
}
