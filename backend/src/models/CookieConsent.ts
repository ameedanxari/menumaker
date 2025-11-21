import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Cookie Consent Entity (Phase 2.6 - GDPR)
 *
 * Tracks user cookie consent preferences for GDPR compliance.
 * Stores consent for: Essential, Analytics, Marketing cookies.
 */

@Entity('cookie_consents')
@Index(['visitor_id'])
@Index(['ip_address'])
export class CookieConsent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Visitor identification (anonymous ID stored in browser)
  @Column({ type: 'varchar', length: 255 })
  visitor_id!: string; // UUID from browser localStorage

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string; // IPv4/IPv6

  @Column({ type: 'varchar', length: 500, nullable: true })
  user_agent?: string;

  // Consent preferences
  @Column({ type: 'boolean', default: true })
  essential!: boolean; // Always true (required for app to function)

  @Column({ type: 'boolean', default: false })
  analytics!: boolean; // Google Analytics, Firebase Analytics

  @Column({ type: 'boolean', default: false })
  marketing!: boolean; // Marketing cookies, ads

  // Consent metadata
  @Column({ type: 'varchar', length: 50 })
  consent_method!: string; // 'accept_all', 'reject_all', 'customize'

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string; // Language of consent banner

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date; // 1 year if accepted, 7 days if rejected

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
