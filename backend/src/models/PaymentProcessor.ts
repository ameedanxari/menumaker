import type { Relation } from 'typeorm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Business } from './Business.js';

/**
 * PaymentProcessor Entity
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Stores payment processor credentials and configuration per business.
 * Supports: Stripe, Razorpay, PhonePe, Paytm
 *
 * Security:
 * - credentials field encrypted at rest
 * - API keys never exposed in API responses
 */

export type ProcessorType = 'stripe' | 'razorpay' | 'phonepe' | 'paytm';
export type SettlementSchedule = 'daily' | 'weekly' | 'monthly';
export type ProcessorStatus = 'active' | 'inactive' | 'pending_verification' | 'failed';

export interface CredentialEncryptionContext {
  businessId: string;
  processorId: string;
  processorType: ProcessorType | string;
}

export interface CredentialEnvelope {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: string;
  algorithm: 'aes-256-gcm';
  context_hash: string;
}

export interface CredentialMetadata {
  present: boolean;
  fields: string[];
  masked: Record<string, string>;
  rotated_at?: string;
  key_version?: string;
}

function canonicalContext(context: CredentialEncryptionContext): string {
  return JSON.stringify({
    business_id: context.businessId,
    processor_id: context.processorId,
    processor_type: context.processorType,
  });
}

function deriveLocalEnvelopeKey(context: CredentialEncryptionContext, keyVersion: string, keyMaterial?: string): Buffer {
  const root = keyMaterial || process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || 'test-only-local-provider-credential-key-material-32-bytes';
  return createHash('sha256')
    .update(root)
    .update('\0')
    .update(keyVersion)
    .update('\0')
    .update(canonicalContext(context))
    .digest();
}

export function maskCredentialValue(value: string): string {
  if (!value) {
    return 'empty';
  }
  const suffix = value.slice(-4);
  return `${'*'.repeat(Math.max(8, value.length - 4))}${suffix}`;
}

export function encryptCredentialPayload(
  credentials: Record<string, string>,
  context: CredentialEncryptionContext,
  keyVersion: string = process.env.PROVIDER_CREDENTIAL_KEY_VERSION || 'local-v1',
  keyMaterial?: string
): CredentialEnvelope {
  const iv = randomBytes(12);
  const key = deriveLocalEnvelopeKey(context, keyVersion, keyMaterial);
  const aad = Buffer.from(canonicalContext(context));
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    key_version: keyVersion,
    algorithm: 'aes-256-gcm',
    context_hash: createHash('sha256').update(aad).digest('hex'),
  };
}

export function decryptCredentialPayload(
  envelope: CredentialEnvelope,
  context: CredentialEncryptionContext,
  keyMaterial?: string
): Record<string, string> {
  if (envelope.algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported credential envelope algorithm: ${envelope.algorithm}`);
  }
  const aad = Buffer.from(canonicalContext(context));
  const expectedContextHash = createHash('sha256').update(aad).digest('hex');
  if (envelope.context_hash !== expectedContextHash) {
    throw new Error('Credential encryption context mismatch');
  }
  const key = deriveLocalEnvelopeKey(context, envelope.key_version, keyMaterial);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.auth_tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as Record<string, string>;
}

export function buildCredentialMetadata(
  credentials: Record<string, string>,
  rotatedAt: Date = new Date(),
  keyVersion?: string
): CredentialMetadata {
  return {
    present: Object.keys(credentials).length > 0,
    fields: Object.keys(credentials).sort(),
    masked: Object.fromEntries(
      Object.entries(credentials).map(([key, value]) => [key, maskCredentialValue(String(value))])
    ),
    rotated_at: rotatedAt.toISOString(),
    key_version: keyVersion,
  };
}

@Entity('payment_processors')
export class PaymentProcessor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Relation<Business>;

  /**
   * Processor type
   * 'stripe' | 'razorpay' | 'phonepe' | 'paytm'
   */
  @Column({ type: 'varchar', length: 50 })
  processor_type!: ProcessorType;

  /**
   * Processor status
   */
  @Column({ type: 'varchar', length: 50, default: 'pending_verification' })
  status!: ProcessorStatus;

  /**
   * Priority for automatic routing
   * Higher number = higher priority (1 = highest)
   * If primary processor fails, fallback to next priority
   */
  @Column({ type: 'integer', default: 999 })
  priority!: number;

  /**
   * Is this processor currently active for taking payments?
   * If false, payments won't be routed to this processor
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * Legacy plaintext credentials are deprecated and no longer selected by
   * default. New writes must use setEncryptedCredentials() so database dumps
   * contain ciphertext plus masked metadata only.
   */
  @Column({ type: 'jsonb', nullable: true, select: false })
  credentials?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  encrypted_credentials?: CredentialEnvelope;

  @Column({ type: 'varchar', length: 255, nullable: true })
  credential_kms_key_id?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  credential_key_version?: string;

  @Column({ type: 'varchar', length: 50, default: 'aws-kms-envelope-v1' })
  credential_algorithm_version!: string;

  @Column({ type: 'jsonb', nullable: true })
  credential_metadata?: CredentialMetadata;

  @Column({ type: 'timestamp', nullable: true })
  credentials_rotated_at?: Date;

  /**
   * Settlement schedule: how often payouts are sent to seller
   * 'daily' = next business day
   * 'weekly' = every Monday
   * 'monthly' = 1st of month
   */
  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  settlement_schedule!: SettlementSchedule;

  /**
   * Minimum payout threshold (in cents)
   * Payouts held until balance exceeds this amount
   * Default: Rs. 500 (50000 paise)
   */
  @Column({ type: 'integer', default: 50000 })
  min_payout_threshold_cents!: number;

  /**
   * Processor fee percentage
   * Stored for display/reporting (actual fees calculated by processor)
   *
   * Typical fees:
   * - Stripe: 2.9% + Rs. 2
   * - Razorpay: 2% (can be 1.75% with volume discount)
   * - PhonePe: 1% + GST
   * - Paytm: 2% + GST
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.0 })
  fee_percentage!: number;

  /**
   * Fixed fee per transaction (in cents)
   * Example: Stripe charges Rs. 2 = 200 paise
   */
  @Column({ type: 'integer', default: 0 })
  fixed_fee_cents!: number;

  /**
   * Processor-specific metadata
   * Can store: merchant_name, account_email, verification_status, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  /**
   * Last successful transaction timestamp
   * Used for monitoring and alerting
   */
  @Column({ type: 'timestamp', nullable: true })
  last_transaction_at?: Date;

  /**
   * Connection verification timestamp
   * When credentials were last verified as working
   */
  @Column({ type: 'timestamp', nullable: true })
  verified_at?: Date;

  /**
   * Connection error details (if failed)
   */
  @Column({ type: 'text', nullable: true })
  connection_error?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  credentialEncryptionContext(): CredentialEncryptionContext {
    return {
      businessId: this.business_id,
      processorId: this.id,
      processorType: this.processor_type,
    };
  }

  setEncryptedCredentials(
    credentials: Record<string, string>,
    options: { kmsKeyId?: string; keyVersion?: string; keyMaterial?: string; rotatedAt?: Date } = {}
  ): void {
    const rotatedAt = options.rotatedAt ?? new Date();
    const keyVersion = options.keyVersion ?? process.env.PROVIDER_CREDENTIAL_KEY_VERSION ?? 'local-v1';
    this.encrypted_credentials = encryptCredentialPayload(
      credentials,
      this.credentialEncryptionContext(),
      keyVersion,
      options.keyMaterial
    );
    this.credential_kms_key_id = options.kmsKeyId ?? process.env.PROVIDER_CREDENTIAL_KMS_KEY_ID ?? 'local-test-kms-key';
    this.credential_key_version = keyVersion;
    this.credential_algorithm_version = 'aws-kms-envelope-v1';
    this.credentials_rotated_at = rotatedAt;
    this.credential_metadata = buildCredentialMetadata(credentials, rotatedAt, keyVersion);
    this.credentials = undefined;
  }

  decryptCredentials(options: { keyMaterial?: string; auditReason?: string } = {}): Record<string, string> {
    if (!options.auditReason) {
      throw new Error('Privileged credential decrypt requires an audit reason');
    }
    if (!this.encrypted_credentials) {
      throw new Error('No encrypted credentials are available');
    }
    return decryptCredentialPayload(
      this.encrypted_credentials,
      this.credentialEncryptionContext(),
      options.keyMaterial
    );
  }

  safeCredentialMetadata(): CredentialMetadata {
    return this.credential_metadata ?? {
      present: false,
      fields: [],
      masked: {},
    };
  }
}
