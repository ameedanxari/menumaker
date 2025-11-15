import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './Business.js';

@Entity('business_settings')
export class BusinessSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Business, (business) => business.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  // Delivery Configuration
  @Column({ type: 'varchar', default: 'flat' })
  delivery_type!: 'flat' | 'distance' | 'free';

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents!: number;

  @Column({ type: 'integer', nullable: true })
  delivery_base_fee_cents?: number;

  @Column({ type: 'integer', nullable: true })
  delivery_per_km_cents?: number;

  @Column({ type: 'integer', nullable: true })
  min_order_free_delivery_cents?: number;

  @Column({ type: 'varchar', default: 'round' })
  distance_rounding!: 'round' | 'ceil' | 'floor';

  // Payment Configuration
  @Column({ type: 'varchar', default: 'cash' })
  payment_method!: 'cash' | 'bank_transfer' | 'upi' | 'other';

  @Column({ type: 'text', nullable: true })
  payment_instructions?: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  // Order Defaults
  @Column({ type: 'boolean', default: false })
  auto_confirm_orders!: boolean;

  @Column({ type: 'boolean', default: true })
  enable_customer_notes!: boolean;

  // WhatsApp Notification Settings (Phase 2.3)
  @Column({ type: 'boolean', default: false })
  whatsapp_enabled!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp_phone_number?: string;

  @Column({ type: 'boolean', default: true })
  whatsapp_notify_new_order!: boolean;

  @Column({ type: 'boolean', default: true })
  whatsapp_notify_order_update!: boolean;

  @Column({ type: 'boolean', default: true })
  whatsapp_notify_payment!: boolean;

  @Column({ type: 'boolean', default: false })
  whatsapp_customer_notifications!: boolean;

  // Tax & Compliance Settings (Phase 3.4)
  /**
   * GSTIN (Goods and Services Tax Identification Number)
   * Format: 22AAAAA0000A1Z5 (15 characters)
   * Required for GST-registered businesses in India
   */
  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string;

  /**
   * Legal business name (for tax invoices)
   * May differ from display name
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  legal_business_name?: string;

  /**
   * Business address (for tax invoices)
   */
  @Column({ type: 'text', nullable: true })
  business_address?: string;

  /**
   * Is business GST registered?
   */
  @Column({ type: 'boolean', default: false })
  is_gst_registered!: boolean;

  /**
   * Invoice prefix (e.g., "INV", "BILL")
   * Used for invoice numbering: INV-2025-0001
   */
  @Column({ type: 'varchar', length: 10, default: 'INV' })
  invoice_prefix!: string;

  /**
   * Next invoice number (auto-incremented)
   */
  @Column({ type: 'integer', default: 1 })
  next_invoice_number!: number;

  /**
   * Bank details for invoice (optional)
   */
  @Column({ type: 'jsonb', nullable: true })
  bank_details?: {
    account_name?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
  };

  /**
   * Invoice terms and conditions (optional)
   */
  @Column({ type: 'text', nullable: true })
  invoice_terms?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
