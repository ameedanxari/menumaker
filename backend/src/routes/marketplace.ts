import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { MarketplaceService, MarketplaceSearchFilters } from '../services/MarketplaceService.js';

/**
 * Marketplace Routes
 * Phase 3 - US3.6: Marketplace & Seller Discovery
 *
 * Endpoints:
 * - GET /marketplace/search - Search sellers
 * - GET /marketplace/featured - Get featured sellers
 * - GET /marketplace/cuisines - Get available cuisines
 * - GET /marketplace/locations - Get available locations
 * - GET /marketplace/seller/:businessId - Get seller profile
 * - GET /marketplace/settings/:businessId - Get marketplace settings (seller)
 * - PUT /marketplace/settings/:businessId - Update marketplace settings (seller)
 * - GET /marketplace/analytics/:businessId - Get marketplace analytics (seller)
 * - POST /marketplace/favorites/:businessId - Add to favorites
 * - DELETE /marketplace/favorites/:businessId - Remove from favorites
 * - GET /marketplace/favorites - Get customer's favorites
 * - POST /marketplace/track/impression/:businessId - Track impression
 * - POST /marketplace/track/click/:businessId - Track menu click
 */
export async function marketplaceRoutes(fastify: FastifyInstance): Promise<void> {
  const marketplaceService = new MarketplaceService();

  /**
   * GET /marketplace/search
   * Search sellers in marketplace
   */
  fastify.get<{
    Querystring: {
      cuisine_types?: string;
      min_rating?: number;
      city?: string;
      state?: string;
      search_query?: string;
      is_featured?: boolean;
      sort_by?: 'rating' | 'distance' | 'newest' | 'popular';
      limit?: number;
      offset?: number;
    };
  }>('/search', async (request, reply) => {
    try {
      const filters: MarketplaceSearchFilters = {
        cuisine_types: request.query.cuisine_types
          ? request.query.cuisine_types.split(',')
          : undefined,
        min_rating: request.query.min_rating,
        city: request.query.city,
        state: request.query.state,
        search_query: request.query.search_query,
        is_featured: request.query.is_featured,
        sort_by: request.query.sort_by,
        limit: request.query.limit,
        offset: request.query.offset,
      };

      const result = await marketplaceService.searchSellers(filters);

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /marketplace/featured
   * Get featured sellers
   */
  fastify.get<{
    Querystring: { limit?: number };
  }>('/featured', async (request, reply) => {
    try {
      const limit = request.query.limit || 10;
      const sellers = await marketplaceService.getFeaturedSellers(limit);

      reply.send({
        success: true,
        data: { sellers },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /marketplace/cuisines
   * Get available cuisine types
   */
  fastify.get('/cuisines', async (request, reply) => {
    try {
      const cuisines = await marketplaceService.getAvailableCuisines();

      reply.send({
        success: true,
        data: { cuisines },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /marketplace/locations
   * Get available locations (cities)
   */
  fastify.get('/locations', async (request, reply) => {
    try {
      const locations = await marketplaceService.getAvailableLocations();

      reply.send({
        success: true,
        data: locations,
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /marketplace/seller/:businessId
   * Get seller profile for marketplace
   */
  fastify.get<{
    Params: { businessId: string };
  }>('/seller/:businessId', async (request, reply) => {
    try {
      const { businessId } = request.params;

      const profile = await marketplaceService.getSellerProfile(businessId);

      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SELLER_NOT_FOUND',
            message: 'Seller not found in marketplace',
          },
        });
      }

      // Check if seller is discoverable
      if (!profile.settings.is_discoverable) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'SELLER_NOT_DISCOVERABLE',
            message: 'This seller has opted out of marketplace discovery',
          },
        });
      }

      // Track impression
      await marketplaceService.trackImpression(businessId);

      reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /marketplace/settings/:businessId
   * Get marketplace settings (seller only)
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/settings/:businessId',
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

        const settings = await marketplaceService.getSettings(businessId);

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
   * PUT /marketplace/settings/:businessId
   * Update marketplace settings (seller only)
   */
  fastify.put<{
    Params: { businessId: string };
    Body: {
      is_discoverable?: boolean;
      cuisine_types?: string[];
      city?: string;
      state?: string;
      show_exact_location?: boolean;
      latitude?: number;
      longitude?: number;
      business_hours?: any;
      contact_phone?: string;
      contact_email?: string;
      short_description?: string;
      tags?: string[];
    };
  }>(
    '/settings/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;
        const updates = request.body;

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

        const settings = await marketplaceService.updateSettings(businessId, updates);

        reply.send({
          success: true,
          data: { settings },
          message: 'Marketplace settings updated successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /marketplace/analytics/:businessId
   * Get marketplace analytics (seller only)
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      startDate: string;
      endDate: string;
    };
  }>(
    '/analytics/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;
        const { startDate, endDate } = request.query;

        if (!startDate || !endDate) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'Start date and end date are required',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne('Business', {
          where: { id: businessId },
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view these analytics',
            },
          });
        }

        const analytics = await marketplaceService.getAnalytics(
          businessId,
          new Date(startDate),
          new Date(endDate)
        );

        reply.send({
          success: true,
          data: { analytics },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /marketplace/favorites/:businessId
   * Add business to favorites
   */
  fastify.post<{
    Params: { businessId: string };
    Body: { notes?: string };
  }>(
    '/favorites/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;
        const { notes } = request.body;

        const favorite = await marketplaceService.addToFavorites(
          request.user!.userId,
          businessId,
          notes
        );

        reply.send({
          success: true,
          data: { favorite },
          message: 'Business added to favorites',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already in favorites')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ALREADY_FAVORITED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /marketplace/favorites/:businessId
   * Remove business from favorites
   */
  fastify.delete<{
    Params: { businessId: string };
  }>(
    '/favorites/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.params;

        await marketplaceService.removeFromFavorites(request.user!.userId, businessId);

        reply.send({
          success: true,
          message: 'Business removed from favorites',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /marketplace/favorites
   * Get customer's favorites
   */
  fastify.get(
    '/favorites',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const favorites = await marketplaceService.getFavorites(request.user!.userId);

        reply.send({
          success: true,
          data: { favorites },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /marketplace/track/impression/:businessId
   * Track marketplace impression (profile view)
   */
  fastify.post<{
    Params: { businessId: string };
  }>('/track/impression/:businessId', async (request, reply) => {
    try {
      const { businessId } = request.params;

      await marketplaceService.trackImpression(businessId);

      reply.send({
        success: true,
        message: 'Impression tracked',
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * POST /marketplace/track/click/:businessId
   * Track menu click from marketplace
   */
  fastify.post<{
    Params: { businessId: string };
  }>('/track/click/:businessId', async (request, reply) => {
    try {
      const { businessId } = request.params;

      await marketplaceService.trackMenuClick(businessId);

      reply.send({
        success: true,
        message: 'Click tracked',
      });
    } catch (error) {
      throw error;
    }
  });
}
