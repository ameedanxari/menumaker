import { AppDataSource } from '../config/database.js';
import { Business } from '../models/Business.js';
import {
  CustomerFavorite,
  MarketplaceAnalytics,
  MarketplaceSettings,
} from '../models/Marketplace.js';

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

export class MarketplaceService {
  async listListings(): Promise<any[]> {
    return this.searchSellers({ limit: 20 }).then((result) => result.sellers);
  }

  async searchSellers(filters: MarketplaceSearchFilters): Promise<{ sellers: any[]; total: number; limit: number; offset: number }> {
    const settingsRepo = AppDataSource.getRepository(MarketplaceSettings);
    const where: any = {
      is_discoverable: true,
      ...(filters.city && { city: filters.city }),
      ...(filters.state && { state: filters.state }),
      ...(typeof filters.is_featured === 'boolean' && { is_featured: filters.is_featured }),
    };
    const [settings, total] = await settingsRepo.findAndCount({
      where,
      relations: ['business'],
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      order: filters.sort_by === 'newest' ? { created_at: 'DESC' } : { featured_priority: 'ASC' },
    });

    return {
      sellers: settings
        .filter((setting) => !filters.cuisine_types?.length || filters.cuisine_types.some((cuisine) => setting.cuisine_types?.includes(cuisine)))
        .map((setting) => ({
          business_id: setting.business_id,
          business: setting.business,
          settings: setting,
        })),
      total,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    };
  }

  async getFeaturedSellers(limit = 10): Promise<any[]> {
    const result = await this.searchSellers({ is_featured: true, limit, sort_by: 'popular' });
    return result.sellers;
  }

  async getAvailableCuisines(): Promise<string[]> {
    const settings = await AppDataSource.getRepository(MarketplaceSettings).find({
      select: ['cuisine_types'],
      where: { is_discoverable: true },
    });
    return [...new Set(settings.flatMap((setting) => setting.cuisine_types ?? []).filter(Boolean))].sort();
  }

  async getAvailableLocations(): Promise<{ cities: string[]; states: string[] }> {
    const settings = await AppDataSource.getRepository(MarketplaceSettings).find({
      select: ['city', 'state'],
      where: { is_discoverable: true },
    });
    return {
      cities: [...new Set(settings.map((setting) => setting.city).filter((city): city is string => Boolean(city)))].sort(),
      states: [...new Set(settings.map((setting) => setting.state).filter((state): state is string => Boolean(state)))].sort(),
    };
  }

  async getSellerProfile(businessId: string): Promise<any | null> {
    const business = await AppDataSource.getRepository(Business).findOne({ where: { id: businessId } });
    const settings = await this.getSettings(businessId);
    if (!business || !settings) {
      return null;
    }
    return {
      business,
      settings,
    };
  }

  async getSettings(businessId: string): Promise<MarketplaceSettings> {
    const repo = AppDataSource.getRepository(MarketplaceSettings);
    const existing = await repo.findOne({ where: { business_id: businessId } });
    if (existing) {
      return existing;
    }
    return repo.save(repo.create({ business_id: businessId, is_discoverable: false }));
  }

  async updateSettings(businessId: string, updates: Partial<MarketplaceSettings>): Promise<MarketplaceSettings> {
    const repo = AppDataSource.getRepository(MarketplaceSettings);
    const settings = await this.getSettings(businessId);
    return repo.save(repo.merge(settings, updates));
  }

  async getAnalytics(businessId: string, startDate: Date, endDate: Date): Promise<MarketplaceAnalytics[]> {
    return AppDataSource.getRepository(MarketplaceAnalytics)
      .createQueryBuilder('analytics')
      .where('analytics.business_id = :businessId', { businessId })
      .andWhere('analytics.date BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      })
      .orderBy('analytics.date', 'ASC')
      .getMany();
  }

  async addToFavorites(customerId: string, businessId: string, notes?: string): Promise<CustomerFavorite> {
    const repo = AppDataSource.getRepository(CustomerFavorite);
    const existing = await repo.findOne({ where: { customer_id: customerId, business_id: businessId } });
    if (existing) {
      throw new Error('Business is already in favorites');
    }
    return repo.save(repo.create({ customer_id: customerId, business_id: businessId, notes }));
  }

  async removeFromFavorites(customerId: string, businessId: string): Promise<void> {
    await AppDataSource.getRepository(CustomerFavorite).delete({ customer_id: customerId, business_id: businessId });
  }

  async getFavorites(customerId: string): Promise<CustomerFavorite[]> {
    return AppDataSource.getRepository(CustomerFavorite).find({
      where: { customer_id: customerId },
      relations: ['business'],
      order: { created_at: 'DESC' },
    });
  }

  async trackImpression(businessId: string): Promise<void> {
    await this.incrementAnalytics(businessId, 'profile_views');
  }

  async trackMenuClick(businessId: string): Promise<void> {
    await this.incrementAnalytics(businessId, 'menu_clicks');
  }

  private async incrementAnalytics(businessId: string, field: 'profile_views' | 'menu_clicks'): Promise<void> {
    const repo = AppDataSource.getRepository(MarketplaceAnalytics);
    const today = new Date();
    const existing = await repo.findOne({
      where: { business_id: businessId, date: today },
    });
    const analytics = existing ?? repo.create({ business_id: businessId, date: today });
    analytics[field] = (analytics[field] ?? 0) + 1;
    await repo.save(analytics);
  }
}
