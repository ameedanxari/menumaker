import { AppDataSource } from '../config/database.js';
import { CookieConsent } from '../models/CookieConsent.js';
import { DeletionRequest } from '../models/DeletionRequest.js';
import { LegalTemplate } from '../models/LegalTemplate.js';
import { User } from '../models/User.js';

/**
 * GDPR Service (Phase 2.6)
 *
 * Handles GDPR compliance features:
 * - Cookie consent tracking
 * - Account deletion requests (30-day grace period)
 * - Legal template management (Privacy Policy, T&C, etc.)
 */

export interface CookieConsentParams {
  visitor_id: string;
  ip_address?: string;
  user_agent?: string;
  consent_method: 'accept_all' | 'reject_all' | 'customize';
  essential?: boolean;
  analytics?: boolean;
  marketing?: boolean;
  language?: string;
}

export interface DeletionRequestParams {
  user_id: string;
  reason?: string;
}

export interface LegalTemplateParams {
  business_id?: string;
  template_type: 'privacy_policy' | 'terms_conditions' | 'refund_policy' | 'allergen_disclaimer';
  jurisdiction?: string;
  content: string;
  customizations?: Record<string, string>;
}

/**
 * GDPR Service
 */
export class GDPRService {
  /**
   * Record cookie consent
   * Stores user's cookie preferences with expiration
   */
  static async recordCookieConsent(params: CookieConsentParams): Promise<CookieConsent> {
    const consentRepo = AppDataSource.getRepository(CookieConsent);

    // Set expiration: 1 year if accepted, 7 days if rejected
    const expiresAt = new Date();
    if (params.consent_method === 'accept_all' || params.consent_method === 'customize') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    }

    // Determine consent values based on method
    let essential = true; // Always true
    let analytics = false;
    let marketing = false;

    if (params.consent_method === 'accept_all') {
      analytics = true;
      marketing = true;
    } else if (params.consent_method === 'customize') {
      analytics = params.analytics ?? false;
      marketing = params.marketing ?? false;
    }

    // Check if consent already exists for this visitor
    const existing = await consentRepo.findOne({
      where: { visitor_id: params.visitor_id },
      order: { created_at: 'DESC' },
    });

    if (existing) {
      // Update existing consent
      existing.ip_address = params.ip_address;
      existing.user_agent = params.user_agent;
      existing.consent_method = params.consent_method;
      existing.essential = essential;
      existing.analytics = analytics;
      existing.marketing = marketing;
      existing.language = params.language || 'en';
      existing.expires_at = expiresAt;

      await consentRepo.save(existing);
      return existing;
    }

    // Create new consent
    const consent = consentRepo.create({
      visitor_id: params.visitor_id,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      consent_method: params.consent_method,
      essential,
      analytics,
      marketing,
      language: params.language || 'en',
      expires_at: expiresAt,
    });

    await consentRepo.save(consent);

    console.log(`✅ Cookie consent recorded: ${params.visitor_id} (${params.consent_method})`);

    return consent;
  }

  /**
   * Get cookie consent for visitor
   */
  static async getCookieConsent(visitor_id: string): Promise<CookieConsent | null> {
    const consentRepo = AppDataSource.getRepository(CookieConsent);

    const consent = await consentRepo.findOne({
      where: { visitor_id },
      order: { created_at: 'DESC' },
    });

    // Check if expired
    if (consent && consent.expires_at && consent.expires_at < new Date()) {
      return null; // Expired
    }

    return consent;
  }

  /**
   * Request account deletion (30-day grace period)
   * User can cancel within 30 days
   */
  static async requestAccountDeletion(params: DeletionRequestParams): Promise<DeletionRequest> {
    const deletionRepo = AppDataSource.getRepository(DeletionRequest);
    const userRepo = AppDataSource.getRepository(User);

    // Find user
    const user = await userRepo.findOne({ where: { id: params.user_id } });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if there's already a pending deletion request
    const existing = await deletionRepo.findOne({
      where: {
        user_id: params.user_id,
        status: 'pending',
      },
    });

    if (existing) {
      throw new Error('Account deletion already requested');
    }

    // Calculate scheduled deletion date (30 days from now)
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30);

    // Create deletion request
    const deletionRequest = deletionRepo.create({
      user_id: params.user_id,
      user_email: user.email,
      status: 'pending',
      reason: params.reason,
      scheduled_deletion_date: scheduledDate,
    });

    await deletionRepo.save(deletionRequest);

    console.log(`⚠️  Deletion requested: ${user.email} (scheduled: ${scheduledDate.toISOString()})`);

    // TODO: Send confirmation email to user (future enhancement)

    return deletionRequest;
  }

  /**
   * Cancel account deletion request
   * User can cancel within the 30-day grace period
   */
  static async cancelDeletionRequest(user_id: string): Promise<DeletionRequest> {
    const deletionRepo = AppDataSource.getRepository(DeletionRequest);

    const deletionRequest = await deletionRepo.findOne({
      where: {
        user_id,
        status: 'pending',
      },
    });

    if (!deletionRequest) {
      throw new Error('No pending deletion request found');
    }

    // Update status
    deletionRequest.status = 'cancelled';
    deletionRequest.cancelled_at = new Date();

    await deletionRepo.save(deletionRequest);

    console.log(`✅ Deletion cancelled: ${deletionRequest.user_email}`);

    return deletionRequest;
  }

  /**
   * Get deletion request status
   */
  static async getDeletionRequestStatus(user_id: string): Promise<DeletionRequest | null> {
    const deletionRepo = AppDataSource.getRepository(DeletionRequest);

    return await deletionRepo.findOne({
      where: { user_id },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * List pending deletion requests (for admin)
   * Phase 2: Manual admin execution
   */
  static async listPendingDeletions(): Promise<DeletionRequest[]> {
    const deletionRepo = AppDataSource.getRepository(DeletionRequest);

    return await deletionRepo.find({
      where: { status: 'pending' },
      order: { scheduled_deletion_date: 'ASC' },
    });
  }

  /**
   * Execute account deletion (admin only, manual in Phase 2)
   * Phase 3: Automated cron job
   */
  static async executeAccountDeletion(
    deletion_request_id: string,
    admin_user_id: string,
    admin_notes?: string
  ): Promise<void> {
    const deletionRepo = AppDataSource.getRepository(DeletionRequest);
    const userRepo = AppDataSource.getRepository(User);

    const deletionRequest = await deletionRepo.findOne({
      where: { id: deletion_request_id },
    });

    if (!deletionRequest) {
      throw new Error('Deletion request not found');
    }

    if (deletionRequest.status !== 'pending') {
      throw new Error(`Cannot execute deletion: status is ${deletionRequest.status}`);
    }

    try {
      // Hard delete user and all related data (CASCADE handles relations)
      await userRepo.delete(deletionRequest.user_id);

      // Update deletion request
      deletionRequest.status = 'completed';
      deletionRequest.completed_at = new Date();
      deletionRequest.admin_user_id = admin_user_id;
      deletionRequest.admin_notes = admin_notes;

      await deletionRepo.save(deletionRequest);

      console.log(`🗑️  Account deleted: ${deletionRequest.user_email} (by admin: ${admin_user_id})`);
    } catch (error: any) {
      // Mark as failed
      deletionRequest.status = 'failed';
      deletionRequest.admin_user_id = admin_user_id;
      deletionRequest.admin_notes = `Failed: ${error.message}`;

      await deletionRepo.save(deletionRequest);

      throw new Error(`Account deletion failed: ${error.message}`);
    }
  }

  /**
   * Create or update legal template
   */
  static async upsertLegalTemplate(params: LegalTemplateParams): Promise<LegalTemplate> {
    const templateRepo = AppDataSource.getRepository(LegalTemplate);

    // Check if template already exists
    const existing = await templateRepo.findOne({
      where: {
        business_id: params.business_id || null,
        template_type: params.template_type,
        jurisdiction: params.jurisdiction || 'IN',
      },
    });

    if (existing) {
      // Update existing template (increment version)
      const currentVersion = parseFloat(existing.version);
      const newVersion = (currentVersion + 0.1).toFixed(1);

      existing.content = params.content;
      existing.customizations = params.customizations ? JSON.stringify(params.customizations) : undefined;
      existing.version = newVersion;

      await templateRepo.save(existing);

      console.log(`✏️  Legal template updated: ${params.template_type} v${newVersion}`);

      return existing;
    }

    // Create new template
    const template = templateRepo.create({
      business_id: params.business_id,
      template_type: params.template_type,
      jurisdiction: params.jurisdiction || 'IN',
      content: params.content,
      customizations: params.customizations ? JSON.stringify(params.customizations) : undefined,
      version: '1.0',
      is_published: false,
    });

    await templateRepo.save(template);

    console.log(`✅ Legal template created: ${params.template_type} v1.0`);

    return template;
  }

  /**
   * Publish legal template
   */
  static async publishLegalTemplate(template_id: string): Promise<LegalTemplate> {
    const templateRepo = AppDataSource.getRepository(LegalTemplate);

    const template = await templateRepo.findOne({ where: { id: template_id } });

    if (!template) {
      throw new Error('Legal template not found');
    }

    template.is_published = true;
    template.published_at = new Date();

    await templateRepo.save(template);

    console.log(`📢 Legal template published: ${template.template_type} v${template.version}`);

    return template;
  }

  /**
   * Get legal template for business
   */
  static async getLegalTemplate(
    business_id: string | undefined,
    template_type: string,
    jurisdiction: string = 'IN'
  ): Promise<LegalTemplate | null> {
    const templateRepo = AppDataSource.getRepository(LegalTemplate);

    // First try to find business-specific template
    if (business_id) {
      const businessTemplate = await templateRepo.findOne({
        where: {
          business_id,
          template_type,
          is_published: true,
        },
        order: { created_at: 'DESC' },
      });

      if (businessTemplate) {
        return businessTemplate;
      }
    }

    // Fallback to system default template
    const defaultTemplate = await templateRepo.findOne({
      where: {
        business_id: null,
        template_type,
        jurisdiction,
        is_published: true,
      },
      order: { created_at: 'DESC' },
    });

    return defaultTemplate;
  }

  /**
   * Render legal template with customizations
   */
  static renderTemplate(template: LegalTemplate): string {
    let rendered = template.content;

    if (template.customizations) {
      try {
        const customizations = JSON.parse(template.customizations);

        // Replace placeholders like {{business_name}}
        for (const [key, value] of Object.entries(customizations)) {
          const placeholder = new RegExp(`{{${key}}}`, 'g');
          rendered = rendered.replace(placeholder, String(value));
        }
      } catch (error) {
        console.error('Failed to parse template customizations:', error);
      }
    }

    return rendered;
  }
}
