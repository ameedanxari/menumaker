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
import { Order } from './Order.js';

export type POSProvider = 'square' | 'dine' | 'zoho';
export type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed' | 'retry';

/**
 * POSIntegration Entity
 * Phase 3 - US3.7: POS System Integration & Order Sync
 *
 * Stores POS integration settings and OAuth credentials
 */
@Entity('pos_integrations')
export class POSIntegration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid', unique: true })
  business_id!: string;

  /**
   * POS provider (square, dine, zoho)
   */
  @Column({ type: 'varchar', length: 50 })
  provider!: POSProvider;

  /**
   * Is integration active?
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * OAuth access token (encrypted)
   */
  @Column({ type: 'text' })
  access_token!: string;

  /**
   * OAuth refresh token (encrypted)
   */
  @Column({ type: 'text', nullable: true })
  refresh_token?: string;

  /**
   * Token expiration timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  token_expires_at?: Date;

  /**
   * POS location/outlet ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  location_id?: string;

  /**
   * POS merchant/account ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  merchant_id?: string;

  /**
   * Auto-sync new orders?
   */
  @Column({ type: 'boolean', default: true })
  auto_sync_orders!: boolean;

  /**
   * Sync customer details?
   */
  @Column({ type: 'boolean', default: true })
  sync_customer_info!: boolean;

  /**
   * Item mapping (MenuMaker dish ID → POS item ID)
   * Format: { "dish-uuid": "pos-item-id" }
   */
  @Column({ type: 'jsonb', nullable: true })
  item_mapping?: Record<string, string>;

  /**
   * Last successful sync timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  last_sync_at?: Date;

  /**
   * Sync error count (reset on success)
   */
  @Column({ type: 'integer', default: 0 })
  error_count!: number;

  /**
   * Last sync error message
   */
  @Column({ type: 'text', nullable: true })
  last_error?: string;

  /**
   * Provider-specific settings
   */
  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    webhook_url?: string;
    api_version?: string;
    tax_handling?: 'auto' | 'manual';
    [key: string]: any;
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * POSSyncLog Entity
 * Tracks every POS sync attempt
 */
@Entity('pos_sync_logs')
@Index(['pos_integration_id', 'created_at'])
@Index(['order_id'])
export class POSSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => POSIntegration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pos_integration_id' })
  pos_integration!: POSIntegration;

  @Column({ type: 'uuid' })
  pos_integration_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  order_id!: string;

  /**
   * Sync status
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: SyncStatus;

  /**
   * POS provider
   */
  @Column({ type: 'varchar', length: 50 })
  provider!: POSProvider;

  /**
   * POS order/transaction ID (from POS system)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  pos_order_id?: string;

  /**
   * Retry attempt count
   */
  @Column({ type: 'integer', default: 0 })
  retry_count!: number;

  /**
   * Max retries (default 12 = 1 hour with 5-min intervals)
   */
  @Column({ type: 'integer', default: 12 })
  max_retries!: number;

  /**
   * Next retry timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  next_retry_at?: Date;

  /**
   * Error message (if failed)
   */
  @Column({ type: 'text', nullable: true })
  error_message?: string;

  /**
   * HTTP status code (if applicable)
   */
  @Column({ type: 'integer', nullable: true })
  http_status?: number;

  /**
   * Request payload sent to POS
   */
  @Column({ type: 'jsonb', nullable: true })
  request_payload?: any;

  /**
   * Response from POS
   */
  @Column({ type: 'jsonb', nullable: true })
  response_data?: any;

  /**
   * Sync duration in milliseconds
   */
  @Column({ type: 'integer', nullable: true })
  duration_ms?: number;

  /**
   * When sync was completed (success or final failure)
   */
  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
