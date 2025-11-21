import type { Relation } from 'typeorm';
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
import { User } from './User.js';

/**
 * MarketplaceSettings Entity
 * Phase 3 - US3.6: Marketplace & Seller Discovery
 *
 * Seller marketplace configuration and opt-in settings
 */
@Entity('marketplace_settings')
export class MarketplaceSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid', unique: true })
  business_id!: string;

  /**
   * Is seller discoverable in marketplace?
   */
  @Column({ type: 'boolean', default: false })
  is_discoverable!: boolean;

  /**
   * Cuisine types offered (for filtering)
   * Examples: Indian, Chinese, Italian, Bakery, Fast Food
   */
  @Column({ type: 'simple-array', default: '' })
  cuisine_types!: string[];

  /**
   * Featured seller status (editorial/admin controlled)
   */
  @Column({ type: 'boolean', default: false })
  is_featured!: boolean;

  /**
   * Featured priority (lower = higher priority)
   */
  @Column({ type: 'integer', default: 999 })
  featured_priority!: number;

  /**
   * Business location (city-level for privacy)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  /**
   * Business location (state/province)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  /**
   * Business location (country)
   */
  @Column({ type: 'varchar', length: 100, default: 'India' })
  country!: string;

  /**
   * Detailed location opt-in (show exact address)
   */
  @Column({ type: 'boolean', default: false })
  show_exact_location!: boolean;

  /**
   * Latitude (for distance calculation)
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  /**
   * Longitude (for distance calculation)
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  /**
   * Business hours (for display)
   */
  @Column({ type: 'jsonb', nullable: true })
  business_hours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };

  /**
   * Contact information (for customer inquiries)
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_phone?: string;

  /**
   * Contact email
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email?: string;

  /**
   * Short description for marketplace listing
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  short_description?: string;

  /**
   * Tags for search (auto-generated + manual)
   */
  @Column({ type: 'simple-array', default: '' })
  tags!: string[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * MarketplaceAnalytics Entity
 * Track marketplace impressions and conversions
 */
@Entity('marketplace_analytics')
@Index(['business_id', 'date'])
export class MarketplaceAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Date for this analytics record
   */
  @Column({ type: 'date' })
  date!: Date;

  /**
   * Marketplace impressions (profile views)
   */
  @Column({ type: 'integer', default: 0 })
  profile_views!: number;

  /**
   * Marketplace clicks (menu views from marketplace)
   */
  @Column({ type: 'integer', default: 0 })
  menu_clicks!: number;

  /**
   * Marketplace orders (orders from marketplace)
   */
  @Column({ type: 'integer', default: 0 })
  marketplace_orders!: number;

  /**
   * Conversion rate (orders / profile_views * 100)
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  conversion_rate!: number;

  /**
   * Search appearances (times appeared in search results)
   */
  @Column({ type: 'integer', default: 0 })
  search_appearances!: number;

  /**
   * Favorite count (times added to favorites)
   */
  @Column({ type: 'integer', default: 0 })
  favorites_added!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * CustomerFavorite Entity
 * Customer's saved favorite sellers
 */
@Entity('customer_favorites')
@Index(['customer_id', 'business_id'], { unique: true })
export class CustomerFavorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Notes about this favorite (optional)
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  notes?: string;

  /**
   * Last order date (for sorting by recent)
   */
  @Column({ type: 'timestamp', nullable: true })
  last_order_at?: Date;

  /**
   * Order count from this seller
   */
  @Column({ type: 'integer', default: 0 })
  order_count!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
