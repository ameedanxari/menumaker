import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ReviewService } from '../src/services/ReviewService';
import { AppDataSource } from '../src/config/database';
import { Review, ReviewResponse, ReviewStatus } from '../src/models/Review';
import { Order } from '../src/models/Order';
import { Business } from '../src/models/Business';
import { User } from '../src/models/User';

// Mock dependencies
jest.mock('../src/config/database');

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockReviewRepository: any;
  let mockResponseRepository: any;
  let mockOrderRepository: any;
  let mockBusinessRepository: any;
  let mockUserRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReviewRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };

    mockResponseRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    mockOrderRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockBusinessRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockUserRepository = {
      findOne: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === Review) return mockReviewRepository;
      if (entity === ReviewResponse) return mockResponseRepository;
      if (entity === Order) return mockOrderRepository;
      if (entity === Business) return mockBusinessRepository;
      if (entity === User) return mockUserRepository;
      return {};
    }) as any;

    reviewService = new ReviewService();
  });

  describe('submitReview', () => {
    it('should successfully submit a 5-star review', async () => {
      const orderId = 'order-123';
      const customerId = 'customer-123';
      const reviewData = {
        rating: 5,
        review_text: 'Excellent food and service!',
        photo_urls: ['photo1.jpg'],
      };

      const mockOrder = {
        id: orderId,
        customer_id: customerId,
        business_id: 'business-123',
        status: 'fulfilled',
        customer_name: 'John Doe',
        total_cents: 5000,
        business: { id: 'business-123' },
        customer: { id: customerId },
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null); // No existing review
      mockReviewRepository.create.mockImplementation((data) => ({ ...data, id: 'review-123' }));
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.submitReview(orderId, customerId, reviewData);

      expect(result.rating).toBe(5);
      expect(result.status).toBe('pending');
      expect(result.is_complaint).toBe(false);
      expect(mockReviewRepository.save).toHaveBeenCalled();
    });

    it('should mark rating < 3 as complaint', async () => {
      const orderId = 'order-123';
      const customerId = 'customer-123';
      const reviewData = {
        rating: 2,
        review_text: 'Poor service',
      };

      const mockOrder = {
        id: orderId,
        customer_id: customerId,
        business_id: 'business-123',
        status: 'fulfilled',
        customer_name: 'John Doe',
        total_cents: 3000,
        business: {},
        customer: {},
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockImplementation((data) => data);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.submitReview(orderId, customerId, reviewData);

      expect(result.is_complaint).toBe(true);
      expect(result.complaint_status).toBe('open');
      expect(result.seller_notified_at).toBeDefined();
    });

    it('should throw error for invalid rating (too low)', async () => {
      await expect(
        reviewService.submitReview('order-123', 'customer-123', { rating: 0 })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw error for invalid rating (too high)', async () => {
      await expect(
        reviewService.submitReview('order-123', 'customer-123', { rating: 6 })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw error for review text exceeding 500 characters', async () => {
      const longText = 'a'.repeat(501);

      await expect(
        reviewService.submitReview('order-123', 'customer-123', {
          rating: 5,
          review_text: longText,
        })
      ).rejects.toThrow('Review text must be 500 characters or less');
    });

    it('should throw error for more than 3 photos', async () => {
      await expect(
        reviewService.submitReview('order-123', 'customer-123', {
          rating: 5,
          photo_urls: ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg'],
        })
      ).rejects.toThrow('Maximum 3 photos allowed');
    });

    it('should throw error if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(
        reviewService.submitReview('nonexistent', 'customer-123', { rating: 5 })
      ).rejects.toThrow('Order not found');
    });

    it('should throw error if customer does not own the order', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'different-customer',
        status: 'fulfilled',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        reviewService.submitReview('order-123', 'customer-123', { rating: 5 })
      ).rejects.toThrow('You can only review your own orders');
    });

    it('should throw error if order is not fulfilled', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        status: 'pending',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        reviewService.submitReview('order-123', 'customer-123', { rating: 5 })
      ).rejects.toThrow('Can only review fulfilled orders');
    });

    it('should throw error if review already exists for order', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        business_id: 'business-123',
        status: 'fulfilled',
        business: {},
        customer: {},
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValueOnce({
        id: 'existing-review',
        order_id: 'order-123',
      });

      await expect(
        reviewService.submitReview('order-123', 'customer-123', { rating: 5 })
      ).rejects.toThrow('Review already submitted for this order');
    });

    it('should set auto-approve timestamp to 24 hours from creation', async () => {
      const orderId = 'order-123';
      const customerId = 'customer-123';

      const mockOrder = {
        id: orderId,
        customer_id: customerId,
        business_id: 'business-123',
        status: 'fulfilled',
        customer_name: 'John',
        total_cents: 1000,
        business: {},
        customer: {},
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockImplementation((data) => data);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.submitReview(orderId, customerId, { rating: 4 });

      expect(result.auto_approve_at).toBeDefined();
      const timeDiff = new Date(result.auto_approve_at).getTime() - Date.now();
      expect(timeDiff).toBeGreaterThan(23 * 60 * 60 * 1000); // Roughly 24 hours
      expect(timeDiff).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('getBusinessReviews', () => {
    it('should return reviews with pagination', async () => {
      const businessId = 'business-123';
      const mockReviews = [
        { id: 'review-1', rating: 5, status: 'approved' },
        { id: 'review-2', rating: 4, status: 'approved' },
      ];

      mockReviewRepository.findAndCount.mockResolvedValue([mockReviews, 2]);

      const result = await reviewService.getBusinessReviews(businessId);

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockReviewRepository.findAndCount).toHaveBeenCalled();
    });

    it('should filter by status when provided', async () => {
      const businessId = 'business-123';

      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await reviewService.getBusinessReviews(businessId, {
        status: 'approved' as ReviewStatus,
      });

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
          }),
        })
      );
    });

    it('should only return public reviews by default', async () => {
      const businessId = 'business-123';

      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await reviewService.getBusinessReviews(businessId);

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_public: true,
          }),
        })
      );
    });

    it('should include private reviews when specified', async () => {
      const businessId = 'business-123';

      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await reviewService.getBusinessReviews(businessId, { includePrivate: true });

      const callArgs = mockReviewRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.is_public).toBeUndefined();
    });

    it('should support pagination parameters', async () => {
      const businessId = 'business-123';

      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await reviewService.getBusinessReviews(businessId, {
        limit: 10,
        offset: 20,
      });

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('moderateReview', () => {
    it('should approve a pending review within 24-hour window', async () => {
      const reviewId = 'review-123';
      const businessId = 'business-123';

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12); // Still within 24 hours

      const mockReview = {
        id: reviewId,
        business_id: businessId,
        status: 'pending' as ReviewStatus,
        auto_approve_at: futureDate,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.moderateReview(reviewId, businessId, 'approve');

      expect(result.status).toBe('approved');
      expect(result.approved_at).toBeDefined();
      expect(result.is_public).toBe(true);
    });

    it('should request removal of a review', async () => {
      const reviewId = 'review-123';
      const businessId = 'business-123';

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      const mockReview = {
        id: reviewId,
        business_id: businessId,
        status: 'pending' as ReviewStatus,
        auto_approve_at: futureDate,
        metadata: {},
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.moderateReview(
        reviewId,
        businessId,
        'request_removal',
        'Inappropriate content'
      );

      expect(result.status).toBe('rejected');
      expect(result.metadata.seller_rejection_reason).toBe('Inappropriate content');
    });

    it('should throw error if review not found', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      await expect(
        reviewService.moderateReview('nonexistent', 'business-123', 'approve')
      ).rejects.toThrow('Review not found');
    });

    it('should throw error if review not pending', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        status: 'approved' as ReviewStatus,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(
        reviewService.moderateReview('review-123', 'business-123', 'approve')
      ).rejects.toThrow('Review is not pending moderation');
    });

    it('should throw error if 24-hour moderation window expired', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 25); // Expired

      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        status: 'pending' as ReviewStatus,
        auto_approve_at: pastDate,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(
        reviewService.moderateReview('review-123', 'business-123', 'approve')
      ).rejects.toThrow('Moderation window has expired (24 hours)');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle review with no text (rating only)', async () => {
      const orderId = 'order-123';
      const customerId = 'customer-123';

      const mockOrder = {
        id: orderId,
        customer_id: customerId,
        business_id: 'business-123',
        status: 'fulfilled',
        customer_name: 'John',
        total_cents: 1000,
        business: {},
        customer: {},
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockImplementation((data) => data);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.submitReview(orderId, customerId, { rating: 4 });

      expect(result.rating).toBe(4);
      expect(result.review_text).toBeUndefined();
    });

    it('should handle review with empty photo array', async () => {
      const orderId = 'order-123';
      const customerId = 'customer-123';

      const mockOrder = {
        id: orderId,
        customer_id: customerId,
        business_id: 'business-123',
        status: 'fulfilled',
        customer_name: 'John',
        total_cents: 1000,
        business: {},
        customer: {},
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockImplementation((data) => data);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.submitReview(orderId, customerId, {
        rating: 5,
        photo_urls: [],
      });

      expect(result.photo_urls).toEqual([]);
    });
  });
});
