import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';

/**
 * Legal Template Entity (Phase 2.6 - GDPR)
 *
 * Stores legal documents (Privacy Policy, Terms & Conditions, Refund Policy)
 * for sellers. Templates can be system-default or business-specific.
 */

@Entity('legal_templates')
@Index(['business_id', 'template_type'])
@Index(['jurisdiction'])
@Index(['is_published'])
export class LegalTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Null = system default template
  @ManyToOne(() => Business, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business?: Business;

  @Column({ type: 'uuid', nullable: true })
  business_id?: string;

  /**
   * Template types:
   * - privacy_policy: GDPR-compliant privacy policy
   * - terms_conditions: Terms and conditions
   * - refund_policy: Refund and cancellation policy
   * - allergen_disclaimer: Allergen information disclaimer
   */
  @Column({ type: 'varchar', length: 100 })
  template_type!: string;

  /**
   * Jurisdiction: IN (India), US, GB (UK), EU, etc.
   */
  @Column({ type: 'varchar', length: 10, default: 'IN' })
  jurisdiction!: string;

  /**
   * Content in Markdown format
   */
  @Column({ type: 'text' })
  content!: string;

  /**
   * Customization placeholders (JSON):
   * {
   *   "business_name": "My Restaurant",
   *   "email": "contact@restaurant.com",
   *   "phone": "+91 98765 43210",
   *   "address": "123 Main St, Mumbai"
   * }
   */
  @Column({ type: 'text', nullable: true })
  customizations?: string; // JSON string

  /**
   * Version for audit trail (e.g., "1.0", "1.1")
   */
  @Column({ type: 'varchar', length: 50, default: '1.0' })
  version!: string;

  /**
   * Published templates appear on public menu footer
   */
  @Column({ type: 'boolean', default: false })
  is_published!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  published_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
