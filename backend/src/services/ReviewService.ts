import { AppDataSource } from '../config/database.js';
import { Review } from '../models/Review.js';

export class ReviewService {
  async createReview(data: Partial<Review>): Promise<Review> {
    const reviewRepo = AppDataSource.getRepository(Review);
    return await reviewRepo.save(reviewRepo.create(data));
  }
}
