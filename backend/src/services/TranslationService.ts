import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Dish } from '../models/Dish.js';
import { DishCategory } from '../models/DishCategory.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import {
  SupportedLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
  getTranslation,
} from '../config/i18n.js';

/**
 * TranslationService
 * Phase 3 - US3.3: Multi-Language Support
 *
 * Handles:
 * - Dish and category translations
 * - Locale resolution (business default, user preference, browser)
 * - Translation management (add, update, delete)
 * - Fallback logic (locale → business default → English)
 */
export class TranslationService {
  private dishRepository: Repository<Dish>;
  private categoryRepository: Repository<DishCategory>;
  private settingsRepository: Repository<BusinessSettings>;

  constructor() {
    this.dishRepository = AppDataSource.getRepository(Dish);
    this.categoryRepository = AppDataSource.getRepository(DishCategory);
    this.settingsRepository = AppDataSource.getRepository(BusinessSettings);
  }

  /**
   * Get business locale settings
   */
  async getBusinessLocaleSettings(businessId: string): Promise<{
    default_locale: SupportedLocale;
    supported_locales: SupportedLocale[];
    rtl_enabled: boolean;
  }> {
    const settings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
    });

    if (!settings) {
      return {
        default_locale: DEFAULT_LOCALE,
        supported_locales: [DEFAULT_LOCALE],
        rtl_enabled: false,
      };
    }

    // Ensure default_locale is valid
    const defaultLocale = isSupportedLocale(settings.default_locale)
      ? (settings.default_locale as SupportedLocale)
      : DEFAULT_LOCALE;

    // Filter supported_locales to only valid locales
    const supportedLocales = settings.supported_locales
      .filter(isSupportedLocale)
      .map((l) => l as SupportedLocale);

    return {
      default_locale: defaultLocale,
      supported_locales: supportedLocales.length > 0 ? supportedLocales : [DEFAULT_LOCALE],
      rtl_enabled: settings.rtl_enabled,
    };
  }

  /**
   * Update business locale settings
   */
  async updateBusinessLocaleSettings(
    businessId: string,
    settings: {
      default_locale?: SupportedLocale;
      supported_locales?: SupportedLocale[];
      rtl_enabled?: boolean;
      date_format?: string;
      time_format?: '12h' | '24h';
      currency_display?: 'symbol' | 'code' | 'name';
    }
  ): Promise<void> {
    const businessSettings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
    });

    if (!businessSettings) {
      throw new Error('Business settings not found');
    }

    if (settings.default_locale) {
      if (!isSupportedLocale(settings.default_locale)) {
        throw new Error(`Unsupported locale: ${settings.default_locale}`);
      }
      businessSettings.default_locale = settings.default_locale;
    }

    if (settings.supported_locales) {
      const invalidLocales = settings.supported_locales.filter(
        (l) => !isSupportedLocale(l)
      );
      if (invalidLocales.length > 0) {
        throw new Error(`Unsupported locales: ${invalidLocales.join(', ')}`);
      }
      businessSettings.supported_locales = settings.supported_locales;
    }

    if (settings.rtl_enabled !== undefined) {
      businessSettings.rtl_enabled = settings.rtl_enabled;
    }

    if (settings.date_format) {
      businessSettings.date_format = settings.date_format;
    }

    if (settings.time_format) {
      businessSettings.time_format = settings.time_format;
    }

    if (settings.currency_display) {
      businessSettings.currency_display = settings.currency_display;
    }

    await this.settingsRepository.save(businessSettings);
  }

  /**
   * Get translated dish name
   */
  getTranslatedDishName(dish: Dish, locale: SupportedLocale): string {
    return getTranslation(dish.name_translations, locale, dish.name);
  }

  /**
   * Get translated dish description
   */
  getTranslatedDishDescription(dish: Dish, locale: SupportedLocale): string {
    return getTranslation(dish.description_translations, locale, dish.description);
  }

  /**
   * Get translated category name
   */
  getTranslatedCategoryName(category: DishCategory, locale: SupportedLocale): string {
    return getTranslation(category.name_translations, locale, category.name);
  }

  /**
   * Get translated category description
   */
  getTranslatedCategoryDescription(
    category: DishCategory,
    locale: SupportedLocale
  ): string {
    return getTranslation(
      category.description_translations,
      locale,
      category.description || ''
    );
  }

  /**
   * Update dish translations
   */
  async updateDishTranslations(
    dishId: string,
    translations: {
      name?: Record<SupportedLocale, string>;
      description?: Record<SupportedLocale, string>;
    }
  ): Promise<Dish> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
    });

    if (!dish) {
      throw new Error('Dish not found');
    }

    if (translations.name) {
      // Validate locales
      const invalidLocales = Object.keys(translations.name).filter(
        (l) => !isSupportedLocale(l)
      );
      if (invalidLocales.length > 0) {
        throw new Error(`Unsupported locales: ${invalidLocales.join(', ')}`);
      }

      dish.name_translations = {
        ...(dish.name_translations || {}),
        ...translations.name,
      };
    }

    if (translations.description) {
      // Validate locales
      const invalidLocales = Object.keys(translations.description).filter(
        (l) => !isSupportedLocale(l)
      );
      if (invalidLocales.length > 0) {
        throw new Error(`Unsupported locales: ${invalidLocales.join(', ')}`);
      }

      dish.description_translations = {
        ...(dish.description_translations || {}),
        ...translations.description,
      };
    }

    await this.dishRepository.save(dish);

    return dish;
  }

  /**
   * Update category translations
   */
  async updateCategoryTranslations(
    categoryId: string,
    translations: {
      name?: Record<SupportedLocale, string>;
      description?: Record<SupportedLocale, string>;
    }
  ): Promise<DishCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (translations.name) {
      // Validate locales
      const invalidLocales = Object.keys(translations.name).filter(
        (l) => !isSupportedLocale(l)
      );
      if (invalidLocales.length > 0) {
        throw new Error(`Unsupported locales: ${invalidLocales.join(', ')}`);
      }

      category.name_translations = {
        ...(category.name_translations || {}),
        ...translations.name,
      };
    }

    if (translations.description) {
      // Validate locales
      const invalidLocales = Object.keys(translations.description).filter(
        (l) => !isSupportedLocale(l)
      );
      if (invalidLocales.length > 0) {
        throw new Error(`Unsupported locales: ${invalidLocales.join(', ')}`);
      }

      category.description_translations = {
        ...(category.description_translations || {}),
        ...translations.description,
      };
    }

    await this.categoryRepository.save(category);

    return category;
  }

  /**
   * Delete dish translation for specific locale
   */
  async deleteDishTranslation(dishId: string, locale: SupportedLocale): Promise<void> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
    });

    if (!dish) {
      throw new Error('Dish not found');
    }

    if (dish.name_translations) {
      delete dish.name_translations[locale];
    }

    if (dish.description_translations) {
      delete dish.description_translations[locale];
    }

    await this.dishRepository.save(dish);
  }

  /**
   * Delete category translation for specific locale
   */
  async deleteCategoryTranslation(
    categoryId: string,
    locale: SupportedLocale
  ): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (category.name_translations) {
      delete category.name_translations[locale];
    }

    if (category.description_translations) {
      delete category.description_translations[locale];
    }

    await this.categoryRepository.save(category);
  }

  /**
   * Get localized dish (with translations applied)
   */
  async getLocalizedDish(
    dishId: string,
    locale: SupportedLocale
  ): Promise<{
    dish: Dish;
    localized: {
      name: string;
      description: string;
    };
  }> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
      relations: ['category', 'business'],
    });

    if (!dish) {
      throw new Error('Dish not found');
    }

    return {
      dish,
      localized: {
        name: this.getTranslatedDishName(dish, locale),
        description: this.getTranslatedDishDescription(dish, locale),
      },
    };
  }

  /**
   * Get localized dishes for business
   */
  async getLocalizedDishes(
    businessId: string,
    locale: SupportedLocale
  ): Promise<
    Array<{
      dish: Dish;
      localized: {
        name: string;
        description: string;
      };
    }>
  > {
    const dishes = await this.dishRepository.find({
      where: { business_id: businessId },
      relations: ['category'],
      order: { position: 'ASC' },
    });

    return dishes.map((dish) => ({
      dish,
      localized: {
        name: this.getTranslatedDishName(dish, locale),
        description: this.getTranslatedDishDescription(dish, locale),
      },
    }));
  }

  /**
   * Get localized categories for business
   */
  async getLocalizedCategories(
    businessId: string,
    locale: SupportedLocale
  ): Promise<
    Array<{
      category: DishCategory;
      localized: {
        name: string;
        description: string;
      };
    }>
  > {
    const categories = await this.categoryRepository.find({
      where: { business_id: businessId },
      order: { sort_order: 'ASC' },
    });

    return categories.map((category) => ({
      category,
      localized: {
        name: this.getTranslatedCategoryName(category, locale),
        description: this.getTranslatedCategoryDescription(category, locale),
      },
    }));
  }
}
