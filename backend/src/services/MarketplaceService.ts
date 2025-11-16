import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import {
  MarketplaceSettings,
  MarketplaceAnalytics,
  CustomerFavorite,
} from '../models/Marketplace.js';
import { Business } from '../models/Business.js';
import { Review } from '../models/Review.js';
import { Order } from '../models/Order.js';
import { Dish } from '../models/Dish.js';

export interface MarketplaceSearchFilters {
  cuisine_types?: string[];
  min_rating?: number;
  city?: string;
  state?: string;
  search_query?: string;
  is_featured?: boolean;
  sort_by?: 'rating' | 'distance' | 'newest' | 'popular';
  limit?: number;
  offset?: number;
}

export interface SellerCard {
  business_id: string;
  business_name: string;
  slug: string;
  logo_url?: string;
  short_description?: string;
  cuisine_types: string[];
  average_rating: number;
  review_count: number;
  is_featured: boolean;
  city?: string;
  state?: string;
  distance_km?: number;
  top_dishes: Array<{
    id: string;
    name: string;
    price_cents: number;
    image_url?: string;
  }>;
}

/**
 * MarketplaceService
 * Phase 3 - US3.6: Marketplace & Seller Discovery
 *
 * Handles:
 * - Seller discovery and search
 * - Marketplace filtering (cuisine, rating, location)
 * - Featured sellers management
 * - Analytics tracking (impressions, conversions)
 * - Customer favorites
 */
export class MarketplaceService {
  private settingsRepository: Repository<MarketplaceSettings>;
  private analyticsRepository: Repository<MarketplaceAnalytics>;
  private favoriteRepository: Repository<CustomerFavorite>;
  private businessRepository: Repository<Business>;
  private reviewRepository: Repository<Review>;
  private orderRepository: Repository<Order>;
  private dishRepository: Repository<Dish>;

  constructor() {
    this.settingsRepository = AppDataSource.getRepository(MarketplaceSettings);
    this.analyticsRepository = AppDataSource.getRepository(MarketplaceAnalytics);
    this.favoriteRepository = AppDataSource.getRepository(CustomerFavorite);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.reviewRepository = AppDataSource.getRepository(Review);
    this.orderRepository = AppDataSource.getRepository(Order);
    this.dishRepository = AppDataSource.getRepository(Dish);
  }

  /**
   * Get or create marketplace settings for a business
   */
  async getSettings(businessId: string): Promise<MarketplaceSettings> {
    let settings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        business_id: businessId,
        is_discoverable: false,
        cuisine_types: [],
        country: 'India',
      });
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Update marketplace settings
   */
  async updateSettings(
    businessId: string,
    updates: Partial<MarketplaceSettings>
  ): Promise<MarketplaceSettings> {
    const settings = await this.getSettings(businessId);

    // Update allowed fields
    if (updates.is_discoverable !== undefined) {
      settings.is_discoverable = updates.is_discoverable;
    }
    if (updates.cuisine_types) {
      settings.cuisine_types = updates.cuisine_types;
    }
    if (updates.city) {
      settings.city = updates.city;
    }
    if (updates.state) {
      settings.state = updates.state;
    }
    if (updates.show_exact_location !== undefined) {
      settings.show_exact_location = updates.show_exact_location;
    }
    if (updates.latitude !== undefined) {
      settings.latitude = updates.latitude;
    }
    if (updates.longitude !== undefined) {
      settings.longitude = updates.longitude;
    }
    if (updates.business_hours) {
      settings.business_hours = updates.business_hours;
    }
    if (updates.contact_phone) {
      settings.contact_phone = updates.contact_phone;
    }
    if (updates.contact_email) {
      settings.contact_email = updates.contact_email;
    }
    if (updates.short_description) {
      settings.short_description = updates.short_description;
    }
    if (updates.tags) {
      settings.tags = updates.tags;
    }

    await this.settingsRepository.save(settings);

    return settings;
  }

  /**
   * Search marketplace sellers
   */
  async searchSellers(filters: MarketplaceSearchFilters): Promise<{
    sellers: SellerCard[];
    total: number;
  }> {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    // Build query
    const queryBuilder = this.settingsRepository
      .createQueryBuilder('settings')
      .leftJoinAndSelect('settings.business', 'business')
      .where('settings.is_discoverable = :discoverable', { discoverable: true })
      .andWhere('business.is_published = :published', { published: true });

    // Filter by cuisine types
    if (filters.cuisine_types && filters.cuisine_types.length > 0) {
      queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM unnest(settings.cuisine_types) AS ct WHERE ct = ANY(:cuisines))',
        { cuisines: filters.cuisine_types }
      );
    }

    // Filter by city
    if (filters.city) {
      queryBuilder.andWhere('LOWER(settings.city) = LOWER(:city)', {
        city: filters.city,
      });
    }

    // Filter by state
    if (filters.state) {
      queryBuilder.andWhere('LOWER(settings.state) = LOWER(:state)', {
        state: filters.state,
      });
    }

    // Filter by featured
    if (filters.is_featured) {
      queryBuilder.andWhere('settings.is_featured = :featured', { featured: true });
    }

    // Search query (business name, description, tags)
    if (filters.search_query) {
      const searchTerm = `%${filters.search_query.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(business.name) LIKE :search OR LOWER(settings.short_description) LIKE :search OR EXISTS (SELECT 1 FROM unnest(settings.tags) AS tag WHERE LOWER(tag) LIKE :search))',
        { search: searchTerm }
      );
    }

    // Sorting
    if (filters.sort_by === 'newest') {
      queryBuilder.orderBy('business.created_at', 'DESC');
    } else if (filters.sort_by === 'rating') {
      // Will sort by average rating after fetching
    } else if (filters.sort_by === 'popular') {
      // Will sort by order count after fetching
    } else if (filters.is_featured) {
      queryBuilder.orderBy('settings.featured_priority', 'ASC');
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get results
    queryBuilder.take(limit).skip(offset);
    const settingsResults = await queryBuilder.getMany();

    // Build seller cards
    const sellers: SellerCard[] = [];

    for (const settings of settingsResults) {
      const business = settings.business;

      // Get review metrics
      const reviews = await this.reviewRepository.find({
        where: {
          business_id: business.id,
          status: 'approved',
          is_public: true,
        },
      });

      const averageRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      // Get top 3 dishes (by order count or position)
      const topDishes = await this.dishRepository.find({
        where: {
          business_id: business.id,
          is_available: true,
        },
        order: { position: 'ASC' },
        take: 3,
      });

      const sellerCard: SellerCard = {
        business_id: business.id,
        business_name: business.name,
        slug: business.slug,
        logo_url: business.logo_url,
        short_description: settings.short_description,
        cuisine_types: settings.cuisine_types,
        average_rating: Math.round(averageRating * 10) / 10,
        review_count: reviews.length,
        is_featured: settings.is_featured,
        city: settings.city,
        state: settings.state,
        top_dishes: topDishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          price_cents: dish.price_cents,
          image_url: dish.image_urls[0],
        })),
      };

      sellers.push(sellerCard);
    }

    // Filter by minimum rating
    let filteredSellers = sellers;
    if (filters.min_rating) {
      filteredSellers = sellers.filter((s) => s.average_rating >= filters.min_rating!);
    }

    // Sort by rating if requested
    if (filters.sort_by === 'rating') {
      filteredSellers.sort((a, b) => b.average_rating - a.average_rating);
    }

    return {
      sellers: filteredSellers,
      total,
    };
  }

  /**
   * Get featured sellers
   */
  async getFeaturedSellers(limit: number = 10): Promise<SellerCard[]> {
    const result = await this.searchSellers({
      is_featured: true,
      limit,
      offset: 0,
    });

    return result.sellers;
  }

  /**
   * Get seller profile for marketplace
   */
  async getSellerProfile(businessId: string): Promise<{
    business: Business;
    settings: MarketplaceSettings;
    metrics: {
      average_rating: number;
      review_count: number;
      total_orders: number;
    };
  } | null> {
    const settings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
      relations: ['business'],
    });

    if (!settings) {
      return null;
    }

    // Get review metrics
    const reviews = await this.reviewRepository.find({
      where: {
        business_id: businessId,
        status: 'approved',
        is_public: true,
      },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    // Get total orders
    const totalOrders = await this.orderRepository.count({
      where: { business_id: businessId },
    });

    return {
      business: settings.business,
      settings,
      metrics: {
        average_rating: Math.round(averageRating * 10) / 10,
        review_count: reviews.length,
        total_orders: totalOrders,
      },
    };
  }

  /**
   * Track marketplace impression (profile view)
   */
  async trackImpression(businessId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.analyticsRepository.findOne({
      where: {
        business_id: businessId,
        date: today,
      },
    });

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        business_id: businessId,
        date: today,
        profile_views: 1,
      });
    } else {
      analytics.profile_views += 1;
    }

    // Update conversion rate
    if (analytics.profile_views > 0) {
      analytics.conversion_rate =
        (analytics.marketplace_orders / analytics.profile_views) * 100;
    }

    await this.analyticsRepository.save(analytics);
  }

  /**
   * Track menu click from marketplace
   */
  async trackMenuClick(businessId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.analyticsRepository.findOne({
      where: {
        business_id: businessId,
        date: today,
      },
    });

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        business_id: businessId,
        date: today,
        menu_clicks: 1,
      });
    } else {
      analytics.menu_clicks += 1;
    }

    await this.analyticsRepository.save(analytics);
  }

  /**
   * Track marketplace order
   */
  async trackMarketplaceOrder(businessId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.analyticsRepository.findOne({
      where: {
        business_id: businessId,
        date: today,
      },
    });

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        business_id: businessId,
        date: today,
        marketplace_orders: 1,
      });
    } else {
      analytics.marketplace_orders += 1;
    }

    // Update conversion rate
    if (analytics.profile_views > 0) {
      analytics.conversion_rate =
        (analytics.marketplace_orders / analytics.profile_views) * 100;
    }

    await this.analyticsRepository.save(analytics);
  }

  /**
   * Get marketplace analytics for a business
   */
  async getAnalytics(
    businessId: string,
    startDate: Date,
    _endDate: Date
  ): Promise<MarketplaceAnalytics[]> {
    return this.analyticsRepository.find({
      where: {
        business_id: businessId,
        date: MoreThanOrEqual(startDate),
      },
      order: { date: 'ASC' },
    });
  }

  /**
   * Add business to favorites
   */
  async addToFavorites(
    customerId: string,
    businessId: string,
    notes?: string
  ): Promise<CustomerFavorite> {
    // Check if already favorited
    const existing = await this.favoriteRepository.findOne({
      where: {
        customer_id: customerId,
        business_id: businessId,
      },
    });

    if (existing) {
      throw new Error('Business already in favorites');
    }

    // Get order count
    const orderCount = await this.orderRepository.count({
      where: {
        customer_id: customerId,
        business_id: businessId,
      },
    });

    // Get last order date
    const lastOrder = await this.orderRepository.findOne({
      where: {
        customer_id: customerId,
        business_id: businessId,
      },
      order: { created_at: 'DESC' },
    });

    const favorite = this.favoriteRepository.create({
      customer_id: customerId,
      business_id: businessId,
      notes,
      order_count: orderCount,
      last_order_at: lastOrder?.created_at,
    });

    await this.favoriteRepository.save(favorite);

    // Track in analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.analyticsRepository.findOne({
      where: {
        business_id: businessId,
        date: today,
      },
    });

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        business_id: businessId,
        date: today,
        favorites_added: 1,
      });
    } else {
      analytics.favorites_added += 1;
    }

    await this.analyticsRepository.save(analytics);

    return favorite;
  }

  /**
   * Remove from favorites
   */
  async removeFromFavorites(customerId: string, businessId: string): Promise<void> {
    await this.favoriteRepository.delete({
      customer_id: customerId,
      business_id: businessId,
    });
  }

  /**
   * Get customer's favorites
   */
  async getFavorites(customerId: string): Promise<CustomerFavorite[]> {
    return this.favoriteRepository.find({
      where: { customer_id: customerId },
      relations: ['business'],
      order: { last_order_at: 'DESC' },
    });
  }

  /**
   * Check if business is favorited by customer
   */
  async isFavorited(customerId: string, businessId: string): Promise<boolean> {
    const favorite = await this.favoriteRepository.findOne({
      where: {
        customer_id: customerId,
        business_id: businessId,
      },
    });

    return !!favorite;
  }

  /**
   * Get available cuisine types (from all discoverable sellers)
   */
  async getAvailableCuisines(): Promise<string[]> {
    const settings = await this.settingsRepository.find({
      where: { is_discoverable: true },
    });

    const cuisines = new Set<string>();
    settings.forEach((s) => {
      s.cuisine_types.forEach((c) => cuisines.add(c));
    });

    return Array.from(cuisines).sort();
  }

  /**
   * Get available cities (from all discoverable sellers)
   */
  async getAvailableLocations(): Promise<{
    cities: Array<{ city: string; state: string; count: number }>;
  }> {
    const settings = await this.settingsRepository.find({
      where: { is_discoverable: true },
    });

    const locationMap = new Map<string, { city: string; state: string; count: number }>();

    settings.forEach((s) => {
      if (s.city && s.state) {
        const key = `${s.city}|${s.state}`;
        const existing = locationMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          locationMap.set(key, { city: s.city, state: s.state, count: 1 });
        }
      }
    });

    return {
      cities: Array.from(locationMap.values()).sort((a, b) =>
        a.city.localeCompare(b.city)
      ),
    };
  }
}
