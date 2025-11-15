import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { TranslationService } from '../services/TranslationService.js';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  isSupportedLocale,
  getLocaleFromHeader,
} from '../config/i18n.js';

/**
 * i18n Routes
 * Phase 3 - US3.3: Multi-Language Support & RTL Layout
 *
 * Endpoints:
 * - GET /i18n/locales - Get supported locales
 * - GET /i18n/business/:businessId/settings - Get business locale settings
 * - PUT /i18n/business/:businessId/settings - Update business locale settings
 * - PUT /i18n/dishes/:dishId/translations - Update dish translations
 * - PUT /i18n/categories/:categoryId/translations - Update category translations
 * - DELETE /i18n/dishes/:dishId/translations/:locale - Delete dish translation
 * - DELETE /i18n/categories/:categoryId/translations/:locale - Delete category translation
 * - GET /i18n/dishes/:dishId - Get localized dish
 * - GET /i18n/dishes/business/:businessId - Get localized dishes for business
 * - GET /i18n/categories/business/:businessId - Get localized categories for business
 */
export async function i18nRoutes(fastify: FastifyInstance): Promise<void> {
  const translationService = new TranslationService();

  /**
   * GET /i18n/locales
   * Get supported locales with metadata
   */
  fastify.get('/locales', async (request, reply) => {
    reply.send({
      success: true,
      data: {
        locales: Object.values(SUPPORTED_LOCALES),
      },
    });
  });

  /**
   * GET /i18n/business/:businessId/settings
   * Get business locale settings
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/business/:businessId/settings',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;

        // Verify business ownership
        const business = await fastify.orm.manager.findOne('Business', {
          where: { id: businessId },
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view these settings',
            },
          });
        }

        const settings = await translationService.getBusinessLocaleSettings(businessId);

        reply.send({
          success: true,
          data: { settings },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * PUT /i18n/business/:businessId/settings
   * Update business locale settings
   */
  fastify.put<{
    Params: { businessId: string };
    Body: {
      default_locale?: SupportedLocale;
      supported_locales?: SupportedLocale[];
      rtl_enabled?: boolean;
      date_format?: string;
      time_format?: '12h' | '24h';
      currency_display?: 'symbol' | 'code' | 'name';
    };
  }>(
    '/business/:businessId/settings',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;
        const settings = request.body;

        // Verify business ownership
        const business = await fastify.orm.manager.findOne('Business', {
          where: { id: businessId },
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update these settings',
            },
          });
        }

        await translationService.updateBusinessLocaleSettings(businessId, settings);

        const updatedSettings = await translationService.getBusinessLocaleSettings(
          businessId
        );

        reply.send({
          success: true,
          data: { settings: updatedSettings },
          message: 'Locale settings updated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unsupported locale')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_LOCALE',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * PUT /i18n/dishes/:dishId/translations
   * Update dish translations
   */
  fastify.put<{
    Params: { dishId: string };
    Body: {
      name?: Record<SupportedLocale, string>;
      description?: Record<SupportedLocale, string>;
    };
  }>(
    '/dishes/:dishId/translations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { dishId } = request.params;
        const translations = request.body;

        // Verify dish ownership
        const dish = await fastify.orm.manager.findOne('Dish', {
          where: { id: dishId },
          relations: ['business'],
        });

        if (!dish) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'DISH_NOT_FOUND',
              message: 'Dish not found',
            },
          });
        }

        if (dish.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this dish',
            },
          });
        }

        const updatedDish = await translationService.updateDishTranslations(
          dishId,
          translations
        );

        reply.send({
          success: true,
          data: { dish: updatedDish },
          message: 'Dish translations updated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unsupported locale')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_LOCALE',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * PUT /i18n/categories/:categoryId/translations
   * Update category translations
   */
  fastify.put<{
    Params: { categoryId: string };
    Body: {
      name?: Record<SupportedLocale, string>;
      description?: Record<SupportedLocale, string>;
    };
  }>(
    '/categories/:categoryId/translations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { categoryId } = request.params;
        const translations = request.body;

        // Verify category ownership
        const category = await fastify.orm.manager.findOne('DishCategory', {
          where: { id: categoryId },
          relations: ['business'],
        });

        if (!category) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'CATEGORY_NOT_FOUND',
              message: 'Category not found',
            },
          });
        }

        if (category.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this category',
            },
          });
        }

        const updatedCategory = await translationService.updateCategoryTranslations(
          categoryId,
          translations
        );

        reply.send({
          success: true,
          data: { category: updatedCategory },
          message: 'Category translations updated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unsupported locale')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_LOCALE',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /i18n/dishes/:dishId/translations/:locale
   * Delete dish translation for specific locale
   */
  fastify.delete<{
    Params: { dishId: string; locale: string };
  }>(
    '/dishes/:dishId/translations/:locale',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { dishId, locale } = request.params;

        if (!isSupportedLocale(locale)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_LOCALE',
              message: `Unsupported locale: ${locale}`,
            },
          });
        }

        // Verify dish ownership
        const dish = await fastify.orm.manager.findOne('Dish', {
          where: { id: dishId },
          relations: ['business'],
        });

        if (!dish) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'DISH_NOT_FOUND',
              message: 'Dish not found',
            },
          });
        }

        if (dish.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this dish',
            },
          });
        }

        await translationService.deleteDishTranslation(dishId, locale as SupportedLocale);

        reply.send({
          success: true,
          message: 'Dish translation deleted successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * DELETE /i18n/categories/:categoryId/translations/:locale
   * Delete category translation for specific locale
   */
  fastify.delete<{
    Params: { categoryId: string; locale: string };
  }>(
    '/categories/:categoryId/translations/:locale',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { categoryId, locale } = request.params;

        if (!isSupportedLocale(locale)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_LOCALE',
              message: `Unsupported locale: ${locale}`,
            },
          });
        }

        // Verify category ownership
        const category = await fastify.orm.manager.findOne('DishCategory', {
          where: { id: categoryId },
          relations: ['business'],
        });

        if (!category) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'CATEGORY_NOT_FOUND',
              message: 'Category not found',
            },
          });
        }

        if (category.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this category',
            },
          });
        }

        await translationService.deleteCategoryTranslation(
          categoryId,
          locale as SupportedLocale
        );

        reply.send({
          success: true,
          message: 'Category translation deleted successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /i18n/dishes/:dishId
   * Get localized dish
   */
  fastify.get<{
    Params: { dishId: string };
    Querystring: { locale?: string };
  }>('/dishes/:dishId', async (request, reply) => {
    try {
      const { dishId } = request.params;
      const locale =
        (request.query.locale as SupportedLocale) ||
        getLocaleFromHeader(request.headers['accept-language']);

      const result = await translationService.getLocalizedDish(dishId, locale);

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'DISH_NOT_FOUND',
            message: 'Dish not found',
          },
        });
      }
      throw error;
    }
  });

  /**
   * GET /i18n/dishes/business/:businessId
   * Get localized dishes for business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: { locale?: string };
  }>('/dishes/business/:businessId', async (request, reply) => {
    try {
      const { businessId } = request.params;
      const locale =
        (request.query.locale as SupportedLocale) ||
        getLocaleFromHeader(request.headers['accept-language']);

      const dishes = await translationService.getLocalizedDishes(businessId, locale);

      reply.send({
        success: true,
        data: { dishes, locale },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /i18n/categories/business/:businessId
   * Get localized categories for business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: { locale?: string };
  }>('/categories/business/:businessId', async (request, reply) => {
    try {
      const { businessId } = request.params;
      const locale =
        (request.query.locale as SupportedLocale) ||
        getLocaleFromHeader(request.headers['accept-language']);

      const categories = await translationService.getLocalizedCategories(
        businessId,
        locale
      );

      reply.send({
        success: true,
        data: { categories, locale },
      });
    } catch (error) {
      throw error;
    }
  });
}
