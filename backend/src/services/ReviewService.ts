import { AppDataSource } from '../config/database.js';
import { Review, type ReviewStatus } from '../models/Review.js';

export interface BusinessReviewOptions {
  status?: ReviewStatus;
  includePrivate?: boolean;
  limit?: number;
  offset?: number;
}

export class ReviewService {
  async createReview(data: Partial<Review>): Promise<Review> {
    const reviewRepo = AppDataSource.getRepository(Review);
    return reviewRepo.save(reviewRepo.create(data));
  }

  async submitReview(
    customerId: string,
    orderId: string,
    data: Pick<Review, 'rating'> & Partial<Pick<Review, 'review_text' | 'photo_urls'>>
  ): Promise<Review> {
    return this.createReview({
      customer_id: customerId,
      order_id: orderId,
      business_id: (data as any).business_id ?? '00000000-0000-0000-0000-000000000000',
      rating: data.rating,
      review_text: data.review_text,
      comment: data.review_text,
      photo_urls: data.photo_urls,
      status: 'pending',
      is_public: false,
    });
  }

  async getReview(id: string): Promise<Review | null> {
    return AppDataSource.getRepository(Review).findOne({ where: { id } });
  }

  async getBusinessReviews(
    businessId: string,
    options: BusinessReviewOptions = {}
  ): Promise<{ reviews: Review[]; total: number }> {
    const where: any = {
      business_id: businessId,
      ...(options.status && { status: options.status }),
      ...(!options.includePrivate && { is_public: true }),
    };
    const [reviews, total] = await AppDataSource.getRepository(Review).findAndCount({
      where,
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
      order: { created_at: 'DESC' },
    });
    return { reviews, total };
  }

  async getPendingReviews(businessId: string): Promise<Review[]> {
    return AppDataSource.getRepository(Review).find({
      where: { business_id: businessId, status: 'pending' },
      order: { created_at: 'ASC' },
    });
  }

  async moderateReview(
    id: string,
    businessId: string,
    action: 'approve' | 'request_removal',
    reason?: string
  ): Promise<Review> {
    const review = await this.requireReviewForBusiness(id, businessId);
    review.status = action === 'approve' ? 'approved' : 'removal_requested';
    review.is_public = action === 'approve';
    review.complaint_reason = reason;
    return AppDataSource.getRepository(Review).save(review);
  }

  async addSellerResponse(
    id: string,
    businessId: string,
    responseText: string,
    responderName: string
  ): Promise<Review> {
    const review = await this.requireReviewForBusiness(id, businessId);
    review.seller_response = responseText;
    review.seller_responder_name = responderName;
    review.seller_responded_at = new Date();
    return AppDataSource.getRepository(Review).save(review);
  }

  async updateComplaintStatus(id: string, businessId: string, status: string): Promise<Review> {
    const review = await this.requireReviewForBusiness(id, businessId);
    review.complaint_status = status as any;
    return AppDataSource.getRepository(Review).save(review);
  }

  async getBusinessMetrics(businessId: string): Promise<{ total: number; average_rating: number; public_reviews: number }> {
    const repo = AppDataSource.getRepository(Review);
    const reviews = await repo.find({ where: { business_id: businessId } });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      total: reviews.length,
      average_rating: reviews.length ? totalRating / reviews.length : 0,
      public_reviews: reviews.filter((review) => review.is_public).length,
    };
  }

  async getReviewTrends(businessId: string, startDate: Date, endDate: Date): Promise<Array<{ date: string; count: number; average_rating: number }>> {
    const reviews = await AppDataSource.getRepository(Review)
      .createQueryBuilder('review')
      .where('review.business_id = :businessId', { businessId })
      .andWhere('review.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const grouped = new Map<string, Review[]>();
    for (const review of reviews) {
      const key = review.created_at.toISOString().slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), review]);
    }
    return [...grouped.entries()].map(([date, dailyReviews]) => ({
      date,
      count: dailyReviews.length,
      average_rating: dailyReviews.reduce((sum, review) => sum + review.rating, 0) / dailyReviews.length,
    }));
  }

  async getCustomerReviewForOrder(orderId: string, customerId: string): Promise<Review | null> {
    return AppDataSource.getRepository(Review).findOne({
      where: { order_id: orderId, customer_id: customerId },
    });
  }

  async canCustomerReview(orderId: string, customerId: string): Promise<{ canReview: boolean; reason?: string }> {
    const existing = await this.getCustomerReviewForOrder(orderId, customerId);
    return existing
      ? { canReview: false, reason: 'Order already has a customer review' }
      : { canReview: true };
  }

  async markAsHelpful(id: string, _userId: string): Promise<void> {
    const review = await this.requireReview(id);
    review.helpful_count += 1;
    await AppDataSource.getRepository(Review).save(review);
  }

  async removeHelpful(id: string, _userId: string): Promise<void> {
    const review = await this.requireReview(id);
    review.helpful_count = Math.max(0, review.helpful_count - 1);
    await AppDataSource.getRepository(Review).save(review);
  }

  async reportReview(id: string, _userId: string, reason?: string): Promise<void> {
    const review = await this.requireReview(id);
    review.report_count += 1;
    review.complaint_reason = reason;
    await AppDataSource.getRepository(Review).save(review);
  }

  private async requireReview(id: string): Promise<Review> {
    const review = await this.getReview(id);
    if (!review) {
      throw new Error('Review not found');
    }
    return review;
  }

  private async requireReviewForBusiness(id: string, businessId: string): Promise<Review> {
    const review = await this.requireReview(id);
    if (review.business_id !== businessId) {
      throw new Error('Review does not belong to this business');
    }
    return review;
  }
}
