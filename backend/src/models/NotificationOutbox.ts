import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type NotificationChannel = 'email' | 'whatsapp' | 'push' | 'sms' | 'in_app';
export type NotificationOutboxStatus = 'pending' | 'sending' | 'sent' | 'retry' | 'dead_letter' | 'cancelled';

export interface NotificationProvider {
  send(record: NotificationOutbox): Promise<{ receiptId?: string; terminal?: boolean }>;
}

@Entity('notification_outbox')
@Index(['deduplication_key', 'channel'], { unique: true })
@Index(['status', 'next_attempt_at'])
@Index(['aggregate_type', 'aggregate_id'])
export class NotificationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  channel!: NotificationChannel;

  @Column({ type: 'varchar', length: 120 })
  template!: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale!: string;

  @Column({ type: 'varchar', length: 255 })
  deduplication_key!: string;

  @Column({ type: 'varchar', length: 80 })
  aggregate_type!: string;

  @Column({ type: 'varchar', length: 120 })
  aggregate_id!: string;

  @Column({ type: 'varchar', length: 255 })
  recipient_ref!: string;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: NotificationOutboxStatus;

  @Column({ type: 'integer', default: 0 })
  attempt_count!: number;

  @Column({ type: 'integer', default: 8 })
  max_attempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  next_attempt_at?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_receipt_id?: string | null;

  @Column({ type: 'text', nullable: true })
  redacted_terminal_error?: string | null;

  @Column({ type: 'boolean', default: false })
  opted_out!: boolean;

  @Column({ type: 'jsonb', default: {} })
  audit!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

export class NotificationOutboxService {
  static buildIntent(params: {
    channel: NotificationChannel;
    template: string;
    locale?: string;
    deduplicationKey: string;
    aggregateType: string;
    aggregateId: string;
    recipientRef: string;
    payload?: Record<string, unknown>;
    optedOut?: boolean;
    audit?: Record<string, unknown>;
  }): NotificationOutbox {
    this.validateIntentParams(params);
    const record = new NotificationOutbox();
    record.channel = params.channel;
    record.template = params.template;
    record.locale = params.locale || 'en';
    record.deduplication_key = params.deduplicationKey;
    record.aggregate_type = params.aggregateType;
    record.aggregate_id = params.aggregateId;
    record.recipient_ref = params.recipientRef;
    record.payload = this.redactPayload(params.payload || {}, 'payload');
    record.status = params.optedOut ? 'cancelled' : 'pending';
    record.attempt_count = 0;
    record.max_attempts = 8;
    record.next_attempt_at = params.optedOut ? null : new Date(0);
    record.provider_receipt_id = null;
    record.redacted_terminal_error = null;
    record.opted_out = params.optedOut || false;
    record.audit = params.audit || {};
    return record;
  }

  static async enqueue(repo: {
    findOne?: (options: unknown) => Promise<NotificationOutbox | null>;
    save: (record: NotificationOutbox) => Promise<NotificationOutbox>;
  }, params: Parameters<typeof NotificationOutboxService.buildIntent>[0]): Promise<NotificationOutbox> {
    this.validateIntentParams(params);
    const existing = repo.findOne
      ? await repo.findOne({ where: { deduplication_key: params.deduplicationKey, channel: params.channel } })
      : null;
    if (existing) return existing;
    return repo.save(this.buildIntent(params));
  }

  static async dispatchOne(
    record: NotificationOutbox,
    provider: NotificationProvider,
    now: Date = new Date()
  ): Promise<NotificationOutbox> {
    if (record.opted_out) {
      record.status = 'cancelled';
      record.next_attempt_at = null;
      return record;
    }
    if (!['pending', 'retry'].includes(record.status)) {
      return record;
    }

    record.status = 'sending';
    record.attempt_count += 1;

    try {
      const result = await provider.send(record);
      if (result.receiptId) {
        this.assertSafeOutboxText(result.receiptId, 'provider receipt');
      }
      record.status = 'sent';
      record.provider_receipt_id = result.receiptId || null;
      record.next_attempt_at = null;
      record.redacted_terminal_error = null;
      return record;
    } catch (error) {
      const message = this.redactError(error instanceof Error ? error.message : String(error));
      if (record.attempt_count >= record.max_attempts) {
        record.status = 'dead_letter';
        record.next_attempt_at = null;
        record.redacted_terminal_error = message;
        return record;
      }

      record.status = 'retry';
      record.redacted_terminal_error = message;
      record.next_attempt_at = new Date(now.getTime() + this.backoffMs(record.attempt_count));
      return record;
    }
  }

  static replay(record: NotificationOutbox, actor: string, reason: string, now: Date = new Date()): NotificationOutbox {
    if (record.status !== 'dead_letter') {
      return record;
    }
    this.assertSafeOutboxText(actor, 'replay actor');
    this.assertSafeOutboxText(reason, 'replay reason');
    record.status = 'retry';
    record.next_attempt_at = now;
    record.audit = {
      ...record.audit,
      replayed_by: actor,
      replay_reason: reason,
      replayed_at: now.toISOString(),
    };
    return record;
  }

  static redactsSecrets(value: unknown): unknown {
    return this.redactPayload(value, 'payload');
  }

  private static backoffMs(attempt: number): number {
    return Math.min(60 * 60 * 1000, Math.pow(2, attempt) * 60 * 1000);
  }

  private static redactPayload(value: unknown, path: string): any {
    if (typeof value === 'string') {
      this.assertSafeOutboxText(value, path);
      return value;
    }
    if (Array.isArray(value)) return value.map((item, index) => this.redactPayload(item, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        this.assertSafeOutboxText(key, `${path} key`);
        if (/(password|secret|token|credential|body|message_body|pan|cvv|authorization)/i.test(key)) {
          return [key, '[redacted]'];
        }
        return [key, this.redactPayload(item, `${path}.${key}`)];
      })
    );
  }

  private static redactError(message: string): string {
    const redacted = message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
      .replace(/(secret|token|password|credential)=([^&\s]+)/gi, '$1=[redacted]');
    return this.hasUnsafeOutboxTextControls(redacted)
      ? 'Provider error contained unsafe control characters'
      : redacted;
  }

  private static validateIntentParams(params: Parameters<typeof NotificationOutboxService.buildIntent>[0]): void {
    this.assertSafeOutboxText(params.channel, 'channel');
    this.assertSafeOutboxText(params.template, 'template');
    this.assertSafeOutboxText(params.locale || 'en', 'locale');
    this.assertSafeOutboxText(params.deduplicationKey, 'deduplicationKey');
    this.assertSafeOutboxText(params.aggregateType, 'aggregateType');
    this.assertSafeOutboxText(params.aggregateId, 'aggregateId');
    this.assertSafeOutboxText(params.recipientRef, 'recipientRef');
  }

  private static assertSafeOutboxText(value: string, field: string): void {
    if (this.hasUnsafeOutboxTextControls(value)) {
      throw new Error(`Notification outbox ${field} contains unsafe control characters`);
    }
  }

  private static hasUnsafeOutboxTextControls(value: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(value);
  }
}
