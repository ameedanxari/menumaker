import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { ReviewService } from '../services/ReviewService.js';
import { ReviewStatus } from '../models/Review.js';
import { Business } from '../models/Business.js';

/**
 * Review Routes
 * Phase 3 - US3.5: Review & Complaint Workflow
 *
 * Endpoints:
 * - POST /reviews - Submit a review
 * - GET /reviews/:id - Get review by ID
 * - GET /reviews/business/:businessId - Get business reviews
 * - GET /reviews/pending/business/:businessId - Get pending reviews (seller only)
 * - PUT /reviews/:id/moderate - Moderate review (seller only)
 * - POST /reviews/:id/response - Add seller response
 * - PUT /reviews/:id/complaint - Update complaint status
 * - GET /reviews/metrics/business/:businessId - Get review metrics
 * - GET /reviews/trends/business/:businessId - Get review trends
 * - GET /reviews/order/:orderId - Get review for order
 * - GET /reviews/order/:orderId/can-review - Check if customer can review
 */
export async function reviewRoutes(fastify: FastifyInstance): Promise<void> {
  const reviewService = new ReviewService();

  /**
   * POST /reviews
   * Submit a review for an order
   */
  fastify.post<{
    Body: {
      order_id: string;
      rating: number;
      review_text?: string;
      photo_urls?: string[];
    };
  }>(
    '/',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { order_id, rating, review_text, photo_urls } = request.body;

        if (!order_id || !rating) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'Order ID and rating are required',
            },
          });
        }

        const review = await reviewService.submitReview(request.user!.userId, order_id, {
          rating,
          review_text,
          photo_urls,
        });

        reply.send({
          success: true,
          data: { review },
          message: 'Review submitted successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'REVIEW_SUBMISSION_FAILED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /reviews/:id
   * Get review by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const review = await reviewService.getReview(id);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found',
        },
      });
    }

    // Only show public reviews to non-owners
    if (!review.is_public && (!request.user || request.user.userId !== review.customer_id)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Review is not public',
        },
      });
    }

    reply.send({
      success: true,
      data: { review },
    });
  });

  /**
   * GET /reviews/business/:businessId
   * Get reviews for a business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      status?: ReviewStatus;
      includePrivate?: boolean;
      limit?: number;
      offset?: number;
    };
  }>('/business/:businessId', async (request, reply) => {
    const { businessId } = request.params;
    const { status, includePrivate, limit, offset } = request.query;

    // Verify business ownership for private reviews
    if (includePrivate) {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: businessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view private reviews',
          },
        });
      }
    }

    const { reviews, total } = await reviewService.getBusinessReviews(businessId, {
      status,
      includePrivate: includePrivate === true,
      limit,
      offset,
    });

    reply.send({
      success: true,
      data: {
        reviews,
        total,
        limit: limit || 50,
        offset: offset || 0,
      },
    });
  });

  /**
   * GET /reviews/pending/business/:businessId
   * Get pending reviews for a business (seller only)
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/pending/business/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = request.params;

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: businessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view pending reviews',
          },
        });
      }

      const reviews = await reviewService.getPendingReviews(businessId);

      reply.send({
        success: true,
        data: { reviews },
      });
    }
  );

  /**
   * PUT /reviews/:id/moderate
   * Moderate a review (seller only)
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      action: 'approve' | 'request_removal';
      reason?: string;
    };
  }>(
    '/:id/moderate',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { action, reason } = request.body;

        if (!action) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_ACTION',
              message: 'Action (approve or request_removal) is required',
            },
          });
        }

        // Get review to verify ownership
        const review = await reviewService.getReview(id);

        if (!review) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'REVIEW_NOT_FOUND',
              message: 'Review not found',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne(Business, {
          where: { id: review.business_id },
          select: ['id', 'owner_id'],
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to moderate this review',
            },
          });
        }

        const updatedReview = await reviewService.moderateReview(
          id,
          review.business_id,
          action,
          reason
        );

        reply.send({
          success: true,
          data: { review: updatedReview },
          message: `Review ${action === 'approve' ? 'approved' : 'submitted for removal'}`,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MODERATION_FAILED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /reviews/:id/response
   * Add seller response to a review
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      response_text: string;
      responder_name: string;
    };
  }>(
    '/:id/response',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { response_text, responder_name } = request.body;

        if (!response_text || !responder_name) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'Response text and responder name are required',
            },
          });
        }

        // Get review to verify ownership
        const review = await reviewService.getReview(id);

        if (!review) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'REVIEW_NOT_FOUND',
              message: 'Review not found',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne(Business, {
          where: { id: review.business_id },
          select: ['id', 'owner_id'],
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to respond to this review',
            },
          });
        }

        const response = await reviewService.addSellerResponse(
          id,
          review.business_id,
          response_text,
          responder_name
        );

        reply.send({
          success: true,
          data: { response },
          message: 'Response added successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'RESPONSE_FAILED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * PUT /reviews/:id/complaint
   * Update complaint status
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      status: 'in_progress' | 'resolved' | 'escalated';
    };
  }>(
    '/:id/complaint',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { status } = request.body;

        if (!status) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_STATUS',
              message: 'Complaint status is required',
            },
          });
        }

        // Get review to verify ownership
        const review = await reviewService.getReview(id);

        if (!review) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'REVIEW_NOT_FOUND',
              message: 'Review not found',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne(Business, {
          where: { id: review.business_id },
          select: ['id', 'owner_id'],
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this complaint',
            },
          });
        }

        const updatedReview = await reviewService.updateComplaintStatus(
          id,
          review.business_id,
          status
        );

        reply.send({
          success: true,
          data: { review: updatedReview },
          message: 'Complaint status updated successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'UPDATE_FAILED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /reviews/metrics/business/:businessId
   * Get review metrics for a business
   */
  fastify.get<{
    Params: { businessId: string };
  }>('/metrics/business/:businessId', async (request, reply) => {
    const { businessId } = request.params;

    const metrics = await reviewService.getBusinessMetrics(businessId);

    reply.send({
      success: true,
      data: { metrics },
    });
  });

  /**
   * GET /reviews/trends/business/:businessId
   * Get review trends for a business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      startDate: string;
      endDate: string;
    };
  }>('/trends/business/:businessId', async (request, reply) => {
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

    const trends = await reviewService.getReviewTrends(
      businessId,
      new Date(startDate),
      new Date(endDate)
    );

    reply.send({
      success: true,
      data: { trends },
    });
  });

  /**
   * GET /reviews/order/:orderId
   * Get review for an order
   */
  fastify.get<{
    Params: { orderId: string };
  }>(
    '/order/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { orderId } = request.params;

      const review = await reviewService.getCustomerReviewForOrder(
        orderId,
        request.user!.userId
      );

      if (!review) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'REVIEW_NOT_FOUND',
            message: 'No review found for this order',
          },
        });
      }

      reply.send({
        success: true,
        data: { review },
      });
    }
  );

  /**
   * GET /reviews/order/:orderId/can-review
   * Check if customer can review an order
   */
  fastify.get<{
    Params: { orderId: string };
  }>(
    '/order/:orderId/can-review',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { orderId } = request.params;

      const result = await reviewService.canCustomerReview(orderId, request.user!.userId);

      reply.send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * POST /reviews/:id/helpful
   * Mark review as helpful
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/helpful',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await reviewService.markAsHelpful(id, request.user!.userId);

        reply.send({
          success: true,
          message: 'Review marked as helpful',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already marked')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ALREADY_MARKED_HELPFUL',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /reviews/:id/helpful
   * Remove helpful mark from review
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/:id/helpful',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params;

      await reviewService.removeHelpful(id, request.user!.userId);

      reply.send({
        success: true,
        message: 'Helpful mark removed',
      });
    }
  );

  /**
   * POST /reviews/:id/report
   * Report review as inappropriate
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/report',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body as { reason?: string };

      try {
        await reviewService.reportReview(id, request.user!.userId, reason);

        reply.send({
          success: true,
          message: 'Review reported successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already reported')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ALREADY_REPORTED',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );
}
