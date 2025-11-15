import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Review, ReviewResponse, ReviewStatus } from '../models/Review.js';
import { Order } from '../models/Order.js';
import { Business } from '../models/Business.js';
import { User } from '../models/User.js';

/**
 * ReviewService
 * Phase 3 - US3.5: Review & Complaint Workflow
 *
 * Handles:
 * - Review submission with validation
 * - Moderation workflow (24-hour seller review window)
 * - Complaint handling (rating < 3)
 * - Seller responses
 * - Review metrics and analytics
 * - Spam prevention
 */
export class ReviewService {
  private reviewRepository: Repository<Review>;
  private responseRepository: Repository<ReviewResponse>;
  private orderRepository: Repository<Order>;
  private businessRepository: Repository<Business>;
  private userRepository: Repository<User>;

  constructor() {
    this.reviewRepository = AppDataSource.getRepository(Review);
    this.responseRepository = AppDataSource.getRepository(ReviewResponse);
    this.orderRepository = AppDataSource.getRepository(Order);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Submit a review for an order
   */
  async submitReview(
    orderId: string,
    customerId: string,
    data: {
      rating: number;
      review_text?: string;
      photo_urls?: string[];
    }
  ): Promise<Review> {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate review text length
    if (data.review_text && data.review_text.length > 500) {
      throw new Error('Review text must be 500 characters or less');
    }

    // Validate photo count
    if (data.photo_urls && data.photo_urls.length > 3) {
      throw new Error('Maximum 3 photos allowed');
    }

    // Get order
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['business', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Verify customer owns this order
    if (order.customer_id !== customerId) {
      throw new Error('You can only review your own orders');
    }

    // Verify order is completed
    if (order.status !== 'completed') {
      throw new Error('Can only review completed orders');
    }

    // Check if review already exists
    const existingReview = await this.reviewRepository.findOne({
      where: { order_id: orderId },
    });

    if (existingReview) {
      throw new Error('Review already submitted for this order');
    }

    // Spam prevention: Check if customer has reviewed this seller in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReview = await this.reviewRepository.findOne({
      where: {
        customer_id: customerId,
        business_id: order.business_id,
        created_at: MoreThan(sevenDaysAgo),
      },
    });

    if (recentReview) {
      throw new Error('You can only review this seller once per week');
    }

    // Create review
    const isComplaint = data.rating < 3;
    const autoApproveAt = new Date();
    autoApproveAt.setHours(autoApproveAt.getHours() + 24);

    const review = this.reviewRepository.create({
      order_id: orderId,
      business_id: order.business_id,
      customer_id: customerId,
      rating: data.rating,
      review_text: data.review_text,
      photo_urls: data.photo_urls || [],
      status: 'pending',
      is_complaint: isComplaint,
      complaint_status: isComplaint ? 'open' : undefined,
      auto_approve_at: autoApproveAt,
      customer_name: order.customer_name,
      is_verified_purchase: true,
      metadata: {
        order_total_cents: order.total_cents,
      },
    });

    await this.reviewRepository.save(review);

    // If complaint, notify seller immediately
    if (isComplaint) {
      review.seller_notified_at = new Date();
      await this.reviewRepository.save(review);

      // TODO: Send email notification to seller about complaint
    }

    return review;
  }

  /**
   * Get review by ID
   */
  async getReview(reviewId: string): Promise<Review | null> {
    return this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['business', 'order', 'customer', 'responses'],
    });
  }

  /**
   * Get reviews for a business
   */
  async getBusinessReviews(
    businessId: string,
    options?: {
      status?: ReviewStatus;
      includePrivate?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ reviews: Review[]; total: number }> {
    const where: any = { business_id: businessId };

    if (options?.status) {
      where.status = options.status;
    }

    if (!options?.includePrivate) {
      where.is_public = true;
    }

    const [reviews, total] = await this.reviewRepository.findAndCount({
      where,
      relations: ['responses'],
      order: { created_at: 'DESC' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return { reviews, total };
  }

  /**
   * Get reviews pending moderation for a business
   */
  async getPendingReviews(businessId: string): Promise<Review[]> {
    const now = new Date();

    return this.reviewRepository.find({
      where: {
        business_id: businessId,
        status: 'pending',
        auto_approve_at: MoreThan(now),
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Moderate review (seller action)
   */
  async moderateReview(
    reviewId: string,
    businessId: string,
    action: 'approve' | 'request_removal',
    reason?: string
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId, business_id: businessId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.status !== 'pending') {
      throw new Error('Review is not pending moderation');
    }

    // Check if still within 24-hour window
    const now = new Date();
    if (review.auto_approve_at && now > review.auto_approve_at) {
      throw new Error('Moderation window has expired (24 hours)');
    }

    if (action === 'approve') {
      review.status = 'approved';
      review.approved_at = new Date();
      review.is_public = true;
    } else if (action === 'request_removal') {
      // Request removal requires admin review
      review.status = 'rejected';
      review.metadata = {
        ...review.metadata,
        seller_rejection_reason: reason,
      };
      // TODO: Notify admin for review
    }

    await this.reviewRepository.save(review);

    return review;
  }

  /**
   * Add seller response to review
   */
  async addSellerResponse(
    reviewId: string,
    businessId: string,
    responseText: string,
    responderName: string
  ): Promise<ReviewResponse> {
    // Validate response length
    if (responseText.length > 500) {
      throw new Error('Response text must be 500 characters or less');
    }

    const review = await this.reviewRepository.findOne({
      where: { id: reviewId, business_id: businessId },
      relations: ['responses'],
    });

    if (!review) {
      throw new Error('Review not found');
    }

    // Only allow responses to approved/public reviews
    if (review.status !== 'approved' || !review.is_public) {
      throw new Error('Can only respond to approved public reviews');
    }

    // Check if seller has already responded
    if (review.has_seller_response) {
      throw new Error('Seller has already responded to this review');
    }

    const response = this.responseRepository.create({
      review_id: reviewId,
      business_id: businessId,
      response_text: responseText,
      responder_name: responderName,
      is_public: true,
    });

    await this.responseRepository.save(response);

    // Update review
    review.has_seller_response = true;
    await this.reviewRepository.save(review);

    return response;
  }

  /**
   * Update complaint status
   */
  async updateComplaintStatus(
    reviewId: string,
    businessId: string,
    status: 'in_progress' | 'resolved' | 'escalated'
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId, business_id: businessId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (!review.is_complaint) {
      throw new Error('This review is not a complaint');
    }

    review.complaint_status = status;
    await this.reviewRepository.save(review);

    return review;
  }

  /**
   * Get review metrics for a business
   */
  async getBusinessMetrics(businessId: string): Promise<{
    average_rating: number;
    total_reviews: number;
    rating_distribution: Record<number, number>;
    recent_reviews: Review[];
    complaints_count: number;
    response_rate: number;
  }> {
    // Get all approved public reviews
    const reviews = await this.reviewRepository.find({
      where: {
        business_id: businessId,
        status: 'approved',
        is_public: true,
      },
      order: { created_at: 'DESC' },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recent_reviews: [],
        complaints_count: 0,
        response_rate: 0,
      };
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / totalReviews;

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    });

    // Recent reviews (last 5)
    const recentReviews = reviews.slice(0, 5);

    // Complaints count
    const complaintsCount = reviews.filter((r) => r.is_complaint).length;

    // Response rate
    const respondedCount = reviews.filter((r) => r.has_seller_response).length;
    const responseRate = (respondedCount / totalReviews) * 100;

    return {
      average_rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      total_reviews: totalReviews,
      rating_distribution: ratingDistribution,
      recent_reviews: recentReviews,
      complaints_count: complaintsCount,
      response_rate: Math.round(responseRate),
    };
  }

  /**
   * Get review trends (monthly)
   */
  async getReviewTrends(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      month: string;
      average_rating: number;
      review_count: number;
    }>
  > {
    const reviews = await this.reviewRepository.find({
      where: {
        business_id: businessId,
        status: 'approved',
        is_public: true,
        created_at: Between(startDate, endDate),
      },
      order: { created_at: 'ASC' },
    });

    // Group by month
    const monthlyData = new Map<string, { total_rating: number; count: number }>();

    reviews.forEach((review) => {
      const month = review.created_at.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthlyData.get(month) || { total_rating: 0, count: 0 };
      existing.total_rating += review.rating;
      existing.count += 1;
      monthlyData.set(month, existing);
    });

    // Convert to array
    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      average_rating: Math.round((data.total_rating / data.count) * 10) / 10,
      review_count: data.count,
    }));
  }

  /**
   * Auto-approve pending reviews after 24 hours
   * Called by cron job
   */
  async autoApprovePendingReviews(): Promise<number> {
    const now = new Date();

    const expiredReviews = await this.reviewRepository.find({
      where: {
        status: 'pending',
        auto_approve_at: LessThan(now),
      },
    });

    for (const review of expiredReviews) {
      review.status = 'approved';
      review.approved_at = new Date();
      review.is_public = true;
      await this.reviewRepository.save(review);
    }

    return expiredReviews.length;
  }

  /**
   * Get customer's review for an order
   */
  async getCustomerReviewForOrder(
    orderId: string,
    customerId: string
  ): Promise<Review | null> {
    return this.reviewRepository.findOne({
      where: {
        order_id: orderId,
        customer_id: customerId,
      },
      relations: ['responses'],
    });
  }

  /**
   * Check if customer can review this order
   */
  async canCustomerReview(orderId: string, customerId: string): Promise<{
    can_review: boolean;
    reason?: string;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      return { can_review: false, reason: 'Order not found' };
    }

    if (order.customer_id !== customerId) {
      return { can_review: false, reason: 'Not your order' };
    }

    if (order.status !== 'completed') {
      return { can_review: false, reason: 'Order not completed yet' };
    }

    // Check if already reviewed
    const existingReview = await this.reviewRepository.findOne({
      where: { order_id: orderId },
    });

    if (existingReview) {
      return { can_review: false, reason: 'Already reviewed' };
    }

    // Check spam prevention (1 review per seller per week)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReview = await this.reviewRepository.findOne({
      where: {
        customer_id: customerId,
        business_id: order.business_id,
        created_at: MoreThan(sevenDaysAgo),
      },
    });

    if (recentReview) {
      return { can_review: false, reason: 'Already reviewed this seller this week' };
    }

    return { can_review: true };
  }
}
