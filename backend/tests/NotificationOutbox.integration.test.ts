import { describe, expect, it, jest } from '@jest/globals';
import { NotificationOutboxService } from '../src/models/NotificationOutbox';

describe('NotificationOutbox transactional helper', () => {
  it('deduplicates enqueue requests and redacts sensitive payload fields', async () => {
    const saved: any[] = [];
    const repo = {
      findOne: jest.fn(async () => saved[0] || null),
      save: jest.fn(async (record: any) => {
        saved.push(record);
        return record;
      }),
    };

    const first = await NotificationOutboxService.enqueue(repo, {
      channel: 'email',
      template: 'welcome',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
      payload: { token: 'secret-token', safe: 'ok' },
    });
    const second = await NotificationOutboxService.enqueue(repo, {
      channel: 'email',
      template: 'welcome',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
    });

    expect(first).toBe(second);
    expect(first.payload).toEqual({ token: '[redacted]', safe: 'ok' });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe control characters in notification intent strings before enqueue', async () => {
    const repo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (record: any) => record),
    };

    await expect(NotificationOutboxService.enqueue(repo, {
      channel: 'email',
      template: 'welcome\u0007',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
    })).rejects.toThrow('unsafe control characters');

    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe control characters in non-secret payload strings and keys', () => {
    expect(() => NotificationOutboxService.buildIntent({
      channel: 'email',
      template: 'welcome',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
      payload: { safe: 'hello\u0001world' },
    })).toThrow('unsafe control characters');

    expect(() => NotificationOutboxService.buildIntent({
      channel: 'email',
      template: 'welcome',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
      payload: { ['bad\u0002key']: 'ok' },
    })).toThrow('unsafe control characters');

    const redacted = NotificationOutboxService.buildIntent({
      channel: 'email',
      template: 'welcome',
      deduplicationKey: 'user-1:welcome',
      aggregateType: 'user',
      aggregateId: 'user-1',
      recipientRef: 'user-1',
      payload: { token: 'secret\u0003token' },
    });
    expect(redacted.payload).toEqual({ token: '[redacted]' });
  });

  it('dispatches, retries with backoff, dead-letters, and supports replay', async () => {
    const record = NotificationOutboxService.buildIntent({
      channel: 'sms',
      template: 'otp',
      deduplicationKey: 'otp-1',
      aggregateType: 'login',
      aggregateId: 'login-1',
      recipientRef: 'user-1',
    });

    const retried = await NotificationOutboxService.dispatchOne(
      record,
      { send: jest.fn(async () => { throw new Error('token=abc123 temporary'); }) },
      new Date('2026-06-20T00:00:00.000Z')
    );
    expect(retried.status).toBe('retry');
    expect(retried.redacted_terminal_error).toContain('token=[redacted]');
    expect(retried.next_attempt_at?.getTime()).toBeGreaterThan(new Date('2026-06-20T00:00:00.000Z').getTime());

    retried.attempt_count = retried.max_attempts - 1;
    const deadLetter = await NotificationOutboxService.dispatchOne(
      retried,
      { send: jest.fn(async () => { throw new Error('Bearer abc123'); }) }
    );
    expect(deadLetter.status).toBe('dead_letter');
    expect(deadLetter.redacted_terminal_error).toBe('Bearer [redacted]');

    const replayed = NotificationOutboxService.replay(deadLetter, 'ops-user', 'provider recovered', new Date('2026-06-21T00:00:00.000Z'));
    expect(replayed.status).toBe('retry');
    expect(replayed.audit).toMatchObject({ replayed_by: 'ops-user', replay_reason: 'provider recovered' });
  });

  it('does not persist unsafe provider receipt or provider error text', async () => {
    const record = NotificationOutboxService.buildIntent({
      channel: 'email',
      template: 'receipt',
      deduplicationKey: 'receipt-1',
      aggregateType: 'order',
      aggregateId: 'order-1',
      recipientRef: 'user-1',
    });

    const retriedReceipt = await NotificationOutboxService.dispatchOne(
      record,
      { send: jest.fn(async () => ({ receiptId: 'provider\u0001receipt' })) },
      new Date('2026-06-20T00:00:00.000Z')
    );

    expect(retriedReceipt.status).toBe('retry');
    expect(retriedReceipt.provider_receipt_id).toBeNull();
    expect(retriedReceipt.redacted_terminal_error).not.toContain('\u0001');

    retriedReceipt.attempt_count = retriedReceipt.max_attempts - 1;
    const deadLetter = await NotificationOutboxService.dispatchOne(
      retriedReceipt,
      { send: jest.fn(async () => { throw new Error('gateway\u0004down token=abc123'); }) }
    );

    expect(deadLetter.status).toBe('dead_letter');
    expect(deadLetter.redacted_terminal_error).toBe('Provider error contained unsafe control characters');
  });

  it('rejects unsafe replay audit strings before mutating a dead-letter record', () => {
    const record = NotificationOutboxService.buildIntent({
      channel: 'sms',
      template: 'otp',
      deduplicationKey: 'otp-2',
      aggregateType: 'login',
      aggregateId: 'login-2',
      recipientRef: 'user-1',
    });
    record.status = 'dead_letter';
    record.next_attempt_at = null;

    expect(() => NotificationOutboxService.replay(record, 'ops\u0001user', 'provider recovered')).toThrow('unsafe control characters');
    expect(record.status).toBe('dead_letter');
  });
});
