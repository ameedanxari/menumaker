import { AppDataSource } from '../config/database.js';
import { CookieConsent } from '../models/CookieConsent.js';
import { DeletionRequest } from '../models/DeletionRequest.js';
import { LegalTemplate } from '../models/LegalTemplate.js';
import { User } from '../models/User.js';
import { createHash, createHmac } from 'node:crypto';

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

export type PrivacyLocationKind = 'table' | 'blob' | 'cache' | 'processor' | 'backup';
export type PrivacyDeletionStrategy = 'delete' | 'anonymize' | 'revoke' | 'expire' | 'retain_with_rationale';

export interface PrivacyDataLocation {
  id: string;
  kind: PrivacyLocationKind;
  owner: string;
  subject_user_id?: string;
  tenant_id?: string;
  exportable: boolean;
  contains_secret?: boolean;
  legal_hold?: boolean;
  retention_rationale?: string;
  deletion_strategy: PrivacyDeletionStrategy;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  processor?: string;
}

export interface PrivacyExportManifest {
  user_id: string;
  generated_at: string;
  format: 'menumaker-privacy-export-v1';
  locations: Array<{
    id: string;
    kind: PrivacyLocationKind;
    owner: string;
    status: 'exported' | 'excluded_secret' | 'retained_with_rationale';
    checksum?: string;
    retention_rationale?: string;
  }>;
  checksum: string;
  signature: string;
}

export interface PrivacyDeletionEvidence {
  location_id: string;
  strategy: PrivacyDeletionStrategy;
  status: 'complete' | 'pending' | 'failed' | 'retained';
  evidence: string;
  retained_record_rationale?: string;
}

export interface PrivacyDeletionResult {
  user_id: string;
  approved_by: string;
  complete: boolean;
  evidence: PrivacyDeletionEvidence[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function signManifest(checksum: string, userId: string): string {
  const secret = process.env.GDPR_EXPORT_SIGNING_SECRET || 'test-only-gdpr-export-signing-secret-32-bytes';
  return createHmac('sha256', secret).update(userId).update(':').update(checksum).digest('hex');
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/(password|secret|token|credential|key|ciphertext|auth_tag|refresh)/i.test(key)) {
        return [key, '[redacted]'];
      }
      return [key, redactSecrets(item)];
    })
  );
}

/**
 * GDPR Service
 */
export class GDPRService {
  static defaultPrivacyLocationsForUser(user_id: string): PrivacyDataLocation[] {
    return [
      { id: 'users', kind: 'table', owner: 'identity', subject_user_id: user_id, exportable: true, deletion_strategy: 'delete' },
      { id: 'businesses', kind: 'table', owner: 'seller', subject_user_id: user_id, exportable: true, deletion_strategy: 'anonymize' },
      { id: 'orders', kind: 'table', owner: 'ordering', subject_user_id: user_id, exportable: true, deletion_strategy: 'anonymize' },
      { id: 'payments', kind: 'table', owner: 'payments', subject_user_id: user_id, exportable: true, deletion_strategy: 'retain_with_rationale', legal_hold: true, retention_rationale: 'payment, chargeback, and accounting evidence' },
      { id: 'tax_invoices', kind: 'table', owner: 'tax', subject_user_id: user_id, exportable: true, deletion_strategy: 'retain_with_rationale', legal_hold: true, retention_rationale: 'statutory tax retention' },
      { id: 'media_objects', kind: 'blob', owner: 'media', subject_user_id: user_id, exportable: true, deletion_strategy: 'delete' },
      { id: 'notifications', kind: 'table', owner: 'notifications', subject_user_id: user_id, exportable: true, deletion_strategy: 'delete' },
      { id: 'audit_logs', kind: 'table', owner: 'security', subject_user_id: user_id, exportable: false, deletion_strategy: 'retain_with_rationale', legal_hold: true, retention_rationale: 'security audit integrity' },
      { id: 'processor_requests', kind: 'processor', owner: 'privacy', subject_user_id: user_id, exportable: true, deletion_strategy: 'delete', processor: 'Stripe/Twilio/Firebase/Anthropic as applicable' },
      { id: 'mobile_local_stores', kind: 'cache', owner: 'mobile', subject_user_id: user_id, exportable: false, deletion_strategy: 'expire' },
      { id: 'backups', kind: 'backup', owner: 'platform', subject_user_id: user_id, exportable: false, deletion_strategy: 'retain_with_rationale', legal_hold: true, retention_rationale: 'backup expiry window; restored backups must replay deletion ledger' },
    ];
  }

  static buildExportManifest(
    user_id: string,
    locations: PrivacyDataLocation[] = GDPRService.defaultPrivacyLocationsForUser(user_id),
    generatedAt: Date = new Date()
  ): PrivacyExportManifest {
    const manifestLocations = locations.map((location) => {
      if (location.subject_user_id && location.subject_user_id !== user_id) {
        throw new Error(`Cross-tenant export blocked for ${location.id}`);
      }
      if (location.contains_secret || !location.exportable) {
        return {
          id: location.id,
          kind: location.kind,
          owner: location.owner,
          status: location.contains_secret ? 'excluded_secret' as const : 'retained_with_rationale' as const,
          retention_rationale: location.retention_rationale || 'not exportable without exposing secrets, other tenants, or security controls',
        };
      }
      const safeData = redactSecrets(location.data ?? {});
      return {
        id: location.id,
        kind: location.kind,
        owner: location.owner,
        status: 'exported' as const,
        checksum: sha256(safeData),
        retention_rationale: location.legal_hold ? location.retention_rationale : undefined,
      };
    });
    const checksum = sha256({ user_id, locations: manifestLocations });
    return {
      user_id,
      generated_at: generatedAt.toISOString(),
      format: 'menumaker-privacy-export-v1',
      locations: manifestLocations,
      checksum,
      signature: signManifest(checksum, user_id),
    };
  }

  static executeDeletionPlan(
    user_id: string,
    locations: PrivacyDataLocation[] = GDPRService.defaultPrivacyLocationsForUser(user_id),
    options: { approvedBy?: string; failedLocationIds?: string[] } = {}
  ): PrivacyDeletionResult {
    if (!options.approvedBy) {
      throw new Error('Destructive privacy deletion requires approval identity');
    }
    const failed = new Set(options.failedLocationIds ?? []);
    const evidence = locations.map((location): PrivacyDeletionEvidence => {
      if (location.subject_user_id && location.subject_user_id !== user_id) {
        throw new Error(`Cross-tenant deletion blocked for ${location.id}`);
      }
      if (failed.has(location.id)) {
        return {
          location_id: location.id,
          strategy: location.deletion_strategy,
          status: 'failed',
          evidence: `failed:${location.id}; resumable without marking complete`,
        };
      }
      if (location.deletion_strategy === 'retain_with_rationale' || location.legal_hold) {
        return {
          location_id: location.id,
          strategy: location.deletion_strategy,
          status: 'retained',
          evidence: `retained:${location.id}:${location.retention_rationale}`,
          retained_record_rationale: location.retention_rationale || 'legal hold',
        };
      }
      return {
        location_id: location.id,
        strategy: location.deletion_strategy,
        status: 'complete',
        evidence: `${location.deletion_strategy}:${location.id}:sha256:${sha256({ user_id, id: location.id, strategy: location.deletion_strategy })}`,
      };
    });
    return {
      user_id,
      approved_by: options.approvedBy,
      complete: evidence.every((item) => item.status === 'complete' || item.status === 'retained'),
      evidence,
    };
  }

  static resumeDeletionPlan(
    previous: PrivacyDeletionResult,
    locations: PrivacyDataLocation[],
    options: { approvedBy: string }
  ): PrivacyDeletionResult {
    const failedIds = previous.evidence
      .filter((item) => item.status === 'failed' || item.status === 'pending')
      .map((item) => item.location_id);
    const retryLocations = locations.filter((location) => failedIds.includes(location.id));
    const retry = GDPRService.executeDeletionPlan(previous.user_id, retryLocations, options);
    const retryById = new Map(retry.evidence.map((item) => [item.location_id, item]));
    const evidence = previous.evidence.map((item) => retryById.get(item.location_id) ?? item);
    return {
      user_id: previous.user_id,
      approved_by: options.approvedBy,
      complete: evidence.every((item) => item.status === 'complete' || item.status === 'retained'),
      evidence,
    };
  }

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
    const essential = true; // Always true
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

    // Launch exception: deletion confirmation notification is tracked in
    // docs/product/capability-registry.yaml under notification_outbox before privacy launch review.

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
