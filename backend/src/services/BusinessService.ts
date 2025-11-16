import { Repository } from 'typeorm';
import { Business } from '../models/Business.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { AppDataSource } from '../config/database.js';
import { generateUniqueSlug } from '../utils/slug.js';
import { BusinessCreateInput, BusinessUpdateInput, BusinessSettingsInput } from '@menumaker/shared';

export class BusinessService {
  private businessRepository: Repository<Business>;
  private settingsRepository: Repository<BusinessSettings>;

  constructor() {
    this.businessRepository = AppDataSource.getRepository(Business);
    this.settingsRepository = AppDataSource.getRepository(BusinessSettings);
  }

  async createBusiness(userId: string, data: Omit<BusinessCreateInput, 'primary_color' | 'locale' | 'timezone'> & { primary_color?: string; locale?: string; timezone?: string }): Promise<Business> {
    // Check if user already has a business
    const existingBusiness = await this.businessRepository.findOne({
      where: { owner_id: userId },
    });

    if (existingBusiness) {
      const error = new Error('User already has a business profile') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 409;
      error.code = 'BUSINESS_EXISTS';
      throw error;
    }

    // Generate unique slug from business name
    const allBusinesses = await this.businessRepository.find({ select: ['slug'] });
    const existingSlugs = allBusinesses.map(b => b.slug);
    const slug = generateUniqueSlug(data.name, existingSlugs);

    // Create business
    const business = this.businessRepository.create({
      owner_id: userId,
      name: data.name,
      slug,
      description: data.description,
      logo_url: data.logo_url,
      primary_color: data.primary_color || '#000000',
      locale: data.locale || 'en',
      timezone: data.timezone || 'Asia/Kolkata',
    });

    await this.businessRepository.save(business);

    // Create default business settings
    const settings = this.settingsRepository.create({
      business_id: business.id,
      delivery_type: 'flat',
      delivery_fee_cents: 0,
      payment_method: 'cash',
      currency: 'INR',
      auto_confirm_orders: false,
      enable_customer_notes: true,
    });

    await this.settingsRepository.save(settings);

    // Reload business with settings
    const businessWithSettings = await this.businessRepository.findOne({
      where: { id: business.id },
      relations: ['settings'],
    });

    return businessWithSettings!;
  }

  async getBusinessById(businessId: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['settings', 'owner'],
    });

    if (!business) {
      const error = new Error('Business not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'BUSINESS_NOT_FOUND';
      throw error;
    }

    return business;
  }

  async getBusinessBySlug(slug: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { slug },
      relations: ['settings'],
    });

    if (!business) {
      const error = new Error('Business not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'BUSINESS_NOT_FOUND';
      throw error;
    }

    return business;
  }

  async getUserBusiness(userId: string): Promise<Business | null> {
    const business = await this.businessRepository.findOne({
      where: { owner_id: userId },
      relations: ['settings'],
    });

    return business;
  }

  async updateBusiness(businessId: string, userId: string, data: BusinessUpdateInput): Promise<Business> {
    const business = await this.getBusinessById(businessId);

    // Verify ownership
    if (business.owner_id !== userId) {
      const error = new Error('You do not have permission to update this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Update business
    Object.assign(business, data);

    await this.businessRepository.save(business);

    return business;
  }

  async updateBusinessSettings(businessId: string, userId: string, data: Partial<BusinessSettingsInput>): Promise<BusinessSettings> {
    const business = await this.getBusinessById(businessId);

    // Verify ownership
    if (business.owner_id !== userId) {
      const error = new Error('You do not have permission to update these settings') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    let settings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
    });

    if (!settings) {
      // Create settings if they don't exist
      settings = this.settingsRepository.create({
        business_id: businessId,
        ...data,
      });
    } else {
      // Update existing settings
      Object.assign(settings, data);
    }

    await this.settingsRepository.save(settings);

    return settings;
  }

  async getBusinessSettings(businessId: string): Promise<BusinessSettings> {
    const settings = await this.settingsRepository.findOne({
      where: { business_id: businessId },
    });

    if (!settings) {
      const error = new Error('Business settings not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'SETTINGS_NOT_FOUND';
      throw error;
    }

    return settings;
  }
}
