import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './Order.js';
import { Business } from './Business.js';

/**
 * TaxInvoice Entity
 * Phase 3: Advanced Reporting & Tax Compliance (US3.4)
 *
 * Stores tax invoice details for GST compliance
 * Auto-generated when order is completed
 */

@Entity('tax_invoices')
@Index(['business_id', 'invoice_number'], { unique: true })
@Index(['order_id'], { unique: true })
export class TaxInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  /**
   * Invoice number (auto-incremented per business)
   * Format: INV-2025-0001, INV-2025-0002, etc.
   */
  @Column({ type: 'varchar', length: 50 })
  invoice_number!: string;

  /**
   * Invoice date (when invoice was generated)
   */
  @Column({ type: 'date' })
  invoice_date!: Date;

  /**
   * Financial year (e.g., "2025-26")
   */
  @Column({ type: 'varchar', length: 7 })
  financial_year!: string;

  // ========== Customer Details (for B2C) ==========

  @Column({ type: 'varchar', length: 255 })
  customer_name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone?: string;

  @Column({ type: 'text', nullable: true })
  customer_address?: string;

  // ========== Seller GSTIN ==========

  /**
   * Seller's GSTIN (if GST registered)
   * Format: 22AAAAA0000A1Z5 (15 characters)
   */
  @Column({ type: 'varchar', length: 15, nullable: true })
  seller_gstin?: string;

  /**
   * Seller's business name (legal name for GST)
   */
  @Column({ type: 'varchar', length: 255 })
  seller_business_name!: string;

  @Column({ type: 'text', nullable: true })
  seller_address?: string;

  // ========== Amount Breakdown ==========

  /**
   * Subtotal (before GST)
   */
  @Column({ type: 'integer' })
  subtotal_cents!: number;

  /**
   * GST breakdown by rate
   * Array of { rate: 5, amount: 1000, gst: 50 }
   */
  @Column({ type: 'jsonb' })
  gst_breakdown!: Array<{
    rate: number; // GST rate (5%, 18%, etc.)
    taxable_amount_cents: number; // Amount before GST
    gst_amount_cents: number; // GST amount
    hsn_sac_code?: string; // HSN/SAC code
  }>;

  /**
   * Total GST amount
   */
  @Column({ type: 'integer' })
  total_gst_cents!: number;

  /**
   * Grand total (subtotal + GST)
   */
  @Column({ type: 'integer' })
  total_cents!: number;

  /**
   * Currency
   */
  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  // ========== Line Items ==========

  /**
   * Invoice line items with GST details
   */
  @Column({ type: 'jsonb' })
  line_items!: Array<{
    description: string; // Dish name
    hsn_sac_code: string; // HSN/SAC code (9963 for food service)
    quantity: number;
    unit_price_cents: number; // Price before GST
    gst_rate: number; // 5% or 18%
    gst_amount_cents: number;
    total_cents: number; // unit_price * quantity + GST
  }>;

  // ========== Payment Details ==========

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method?: string; // UPI, Card, Cash, etc.

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_reference?: string; // Transaction ID

  // ========== PDF Generation ==========

  /**
   * PDF file URL (stored in S3/MinIO)
   */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  pdf_url?: string;

  /**
   * PDF generation status
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  pdf_status!: 'pending' | 'generated' | 'failed';

  /**
   * PDF generation error (if failed)
   */
  @Column({ type: 'text', nullable: true })
  pdf_error?: string;

  // ========== Metadata ==========

  /**
   * Additional metadata
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    terms_and_conditions?: string;
    notes?: string;
    bank_details?: {
      account_name?: string;
      account_number?: string;
      ifsc_code?: string;
      bank_name?: string;
    };
  };

  @CreateDateColumn()
  created_at!: Date;
}
