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

  describe('getReview', () => {
    it('should get review by ID with relations', async () => {
      const mockReview = {
        id: 'review-123',
        rating: 5,
        business: {},
        order: {},
        customer: {},
        responses: [],
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      const result = await reviewService.getReview('review-123');

      expect(result).toEqual(mockReview);
      expect(mockReviewRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-123' },
          relations: ['business', 'order', 'customer', 'responses'],
        })
      );
    });

    it('should return null if review not found', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      const result = await reviewService.getReview('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingReviews', () => {
    it('should get pending reviews within moderation window', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      const mockReviews = [
        {
          id: 'review-1',
          status: 'pending',
          auto_approve_at: futureDate,
        },
      ];

      mockReviewRepository.find.mockResolvedValue(mockReviews);

      const result = await reviewService.getPendingReviews('business-123');

      expect(result).toEqual(mockReviews);
      expect(mockReviewRepository.find).toHaveBeenCalled();
    });
  });

  describe('addSellerResponse', () => {
    it('should add seller response to approved review', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        status: 'approved',
        is_public: true,
        has_seller_response: false,
        responses: [],
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockResponseRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'response-123',
      }));
      mockResponseRepository.save.mockImplementation((data) => Promise.resolve(data));
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.addSellerResponse(
        'review-123',
        'business-123',
        'Thank you for your feedback',
        'Restaurant Owner'
      );

      expect(result.response_text).toBe('Thank you for your feedback');
      expect(result.is_public).toBe(true);
      expect(mockResponseRepository.save).toHaveBeenCalled();
    });

    it('should throw error for response text exceeding 500 characters', async () => {
      const longText = 'a'.repeat(501);

      await expect(
        reviewService.addSellerResponse('review-123', 'business-123', longText, 'Owner')
      ).rejects.toThrow('Response text must be 500 characters or less');
    });

    it('should throw error if review not found', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      await expect(
        reviewService.addSellerResponse('nonexistent', 'business-123', 'Response', 'Owner')
      ).rejects.toThrow('Review not found');
    });

    it('should throw error if review is not approved', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        status: 'pending',
        is_public: false,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(
        reviewService.addSellerResponse('review-123', 'business-123', 'Response', 'Owner')
      ).rejects.toThrow('Can only respond to approved public reviews');
    });

    it('should throw error if seller already responded', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        status: 'approved',
        is_public: true,
        has_seller_response: true,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(
        reviewService.addSellerResponse('review-123', 'business-123', 'Response', 'Owner')
      ).rejects.toThrow('Seller has already responded to this review');
    });
  });

  describe('updateComplaintStatus', () => {
    it('should update complaint status to resolved', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        is_complaint: true,
        complaint_status: 'open',
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.updateComplaintStatus(
        'review-123',
        'business-123',
        'resolved'
      );

      expect(result.complaint_status).toBe('resolved');
      expect(mockReviewRepository.save).toHaveBeenCalled();
    });

    it('should throw error if review not found', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      await expect(
        reviewService.updateComplaintStatus('nonexistent', 'business-123', 'resolved')
      ).rejects.toThrow('Review not found');
    });

    it('should throw error if review is not a complaint', async () => {
      const mockReview = {
        id: 'review-123',
        business_id: 'business-123',
        is_complaint: false,
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(
        reviewService.updateComplaintStatus('review-123', 'business-123', 'resolved')
      ).rejects.toThrow('This review is not a complaint');
    });
  });

  describe('getBusinessMetrics', () => {
    it('should calculate metrics for business with reviews', async () => {
      const mockReviews = [
        { rating: 5, is_complaint: false, has_seller_response: true, created_at: new Date() },
        { rating: 4, is_complaint: false, has_seller_response: false, created_at: new Date() },
        { rating: 3, is_complaint: false, has_seller_response: true, created_at: new Date() },
        { rating: 5, is_complaint: false, has_seller_response: false, created_at: new Date() },
        { rating: 2, is_complaint: true, has_seller_response: true, created_at: new Date() },
      ];

      mockReviewRepository.find.mockResolvedValue(mockReviews);

      const result = await reviewService.getBusinessMetrics('business-123');

      expect(result.total_reviews).toBe(5);
      expect(result.average_rating).toBe(3.8); // (5+4+3+5+2)/5
      expect(result.rating_distribution[5]).toBe(2);
      expect(result.rating_distribution[4]).toBe(1);
      expect(result.rating_distribution[3]).toBe(1);
      expect(result.rating_distribution[2]).toBe(1);
      expect(result.complaints_count).toBe(1);
      expect(result.response_rate).toBe(60); // 3 out of 5 responded
      expect(result.recent_reviews).toHaveLength(5);
    });

    it('should return zero metrics for business with no reviews', async () => {
      mockReviewRepository.find.mockResolvedValue([]);

      const result = await reviewService.getBusinessMetrics('business-123');

      expect(result.total_reviews).toBe(0);
      expect(result.average_rating).toBe(0);
      expect(result.complaints_count).toBe(0);
      expect(result.response_rate).toBe(0);
      expect(result.recent_reviews).toHaveLength(0);
    });
  });

  describe('getReviewTrends', () => {
    it('should calculate monthly review trends', async () => {
      const mockReviews = [
        {
          rating: 5,
          created_at: new Date('2025-01-15'),
        },
        {
          rating: 4,
          created_at: new Date('2025-01-20'),
        },
        {
          rating: 3,
          created_at: new Date('2025-02-10'),
        },
      ];

      mockReviewRepository.find.mockResolvedValue(mockReviews);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-02-28');

      const result = await reviewService.getReviewTrends('business-123', startDate, endDate);

      expect(result).toHaveLength(2); // Jan and Feb
      expect(result[0].month).toBe('2025-01');
      expect(result[0].average_rating).toBe(4.5); // (5+4)/2
      expect(result[0].review_count).toBe(2);
      expect(result[1].month).toBe('2025-02');
      expect(result[1].average_rating).toBe(3);
      expect(result[1].review_count).toBe(1);
    });
  });

  describe('autoApprovePendingReviews', () => {
    it('should auto-approve expired pending reviews', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 25); // Expired

      const mockReviews = [
        {
          id: 'review-1',
          status: 'pending',
          auto_approve_at: pastDate,
        },
        {
          id: 'review-2',
          status: 'pending',
          auto_approve_at: pastDate,
        },
      ];

      mockReviewRepository.find.mockResolvedValue(mockReviews);
      mockReviewRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await reviewService.autoApprovePendingReviews();

      expect(result).toBe(2);
      expect(mockReviewRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no expired reviews', async () => {
      mockReviewRepository.find.mockResolvedValue([]);

      const result = await reviewService.autoApprovePendingReviews();

      expect(result).toBe(0);
    });
  });

  describe('getCustomerReviewForOrder', () => {
    it('should get customer review for specific order', async () => {
      const mockReview = {
        id: 'review-123',
        order_id: 'order-123',
        customer_id: 'customer-123',
        responses: [],
      };

      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      const result = await reviewService.getCustomerReviewForOrder('order-123', 'customer-123');

      expect(result).toEqual(mockReview);
      expect(mockReviewRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            order_id: 'order-123',
            customer_id: 'customer-123',
          },
          relations: ['responses'],
        })
      );
    });

    it('should return null if no review found', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      const result = await reviewService.getCustomerReviewForOrder('order-123', 'customer-123');

      expect(result).toBeNull();
    });
  });

  describe('canCustomerReview', () => {
    it('should return true if customer can review', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        business_id: 'business-123',
        status: 'fulfilled',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValue(null);

      const result = await reviewService.canCustomerReview('order-123', 'customer-123');

      expect(result.can_review).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      const result = await reviewService.canCustomerReview('nonexistent', 'customer-123');

      expect(result.can_review).toBe(false);
      expect(result.reason).toBe('Order not found');
    });

    it('should return false if not customer order', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'different-customer',
        status: 'fulfilled',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await reviewService.canCustomerReview('order-123', 'customer-123');

      expect(result.can_review).toBe(false);
      expect(result.reason).toBe('Not your order');
    });

    it('should return false if order not fulfilled', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        status: 'pending',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await reviewService.canCustomerReview('order-123', 'customer-123');

      expect(result.can_review).toBe(false);
      expect(result.reason).toBe('Order not fulfilled yet');
    });

    it('should return false if already reviewed', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        business_id: 'business-123',
        status: 'fulfilled',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne.mockResolvedValueOnce({
        id: 'existing-review',
        order_id: 'order-123',
      });

      const result = await reviewService.canCustomerReview('order-123', 'customer-123');

      expect(result.can_review).toBe(false);
      expect(result.reason).toBe('Already reviewed');
    });

    it('should return false if reviewed seller this week', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'customer-123',
        business_id: 'business-123',
        status: 'fulfilled',
      };

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne
        .mockResolvedValueOnce(null) // No review for this order
        .mockResolvedValueOnce({
          // Recent review for this seller
          id: 'recent-review',
          customer_id: 'customer-123',
          business_id: 'business-123',
          created_at: recentDate,
        });

      const result = await reviewService.canCustomerReview('order-123', 'customer-123');

      expect(result.can_review).toBe(false);
      expect(result.reason).toBe('Already reviewed this seller this week');
    });
  });

  describe('spam prevention', () => {
    it('should throw error if customer reviewed seller within 7 days', async () => {
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

      const recentReview = {
        id: 'recent-review',
        customer_id: customerId,
        business_id: 'business-123',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockReviewRepository.findOne
        .mockResolvedValueOnce(null) // No review for this order
        .mockResolvedValueOnce(recentReview); // Recent review for this seller

      await expect(
        reviewService.submitReview(orderId, customerId, { rating: 5 })
      ).rejects.toThrow('You can only review this seller once per week');
    });
  });
});
