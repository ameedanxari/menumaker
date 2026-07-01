import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ModerationService } from '../src/services/ModerationService';

describe('ModerationService action execution', () => {
  const flag = {
    id: 'flag-1',
    flag_type: 'review',
    target_id: 'review-1',
    reason: 'spam',
    status: 'pending',
    reporter: { id: 'reporter-1', email: 'reporter@example.com' },
  } as any;

  beforeEach(() => {
    (ModerationService as any).flagRepo = {
      findOne: jest.fn(async () => ({ ...flag })),
      find: jest.fn(async () => [{ ...flag }, { ...flag, id: 'flag-2' }]),
      create: jest.fn((record) => record),
      save: jest.fn(async (record) => record),
      count: jest.fn(async () => 0),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    (ModerationService as any).auditLogRepo = {
      save: jest.fn(async (record) => record),
    };
    (ModerationService as any).userRepo = {
      save: jest.fn(async (record) => record),
    };
    ModerationService.setContentAdapterForTesting('review', null);
  });

  it('executes content adapters and writes mutation results to audit details', async () => {
    const hide = jest.fn(async () => ({ status: 'hidden', before: true, after: false }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    const result = await ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed spam',
      ip_address: '127.0.0.1',
    });

    expect(hide).toHaveBeenCalledWith('review-1', {
      actor: 'admin-1',
      reason: 'confirmed spam',
    });
    expect((ModerationService as any).auditLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'approve_flag',
      details: expect.objectContaining({
        content_mutation: expect.objectContaining({
          status: 'hidden',
          flag_type: 'review',
          target_id: 'review-1',
          action: 'content_hidden',
          actor: 'admin-1',
          reason: 'confirmed spam',
          before: true,
          after: false,
          applied: true,
        }),
      }),
    }));
    expect(result.content_mutation).toEqual(expect.objectContaining({
      status: 'hidden',
      applied: true,
      actor: 'admin-1',
      before: true,
      after: false,
    }));
    expect(typeof result.content_mutation.occurred_at).toBe('string');
  });

  it('rejects unavailable content actions before marking flags approved', async () => {
    await expect(ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed spam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation action content_hidden is unavailable for review');

    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe flag descriptions before duplicate lookup or persistence', async () => {
    await expect(ModerationService.submitFlag({
      flag_type: 'review',
      target_id: 'review-1',
      reason: 'spam',
      description: '\uFEFFSpam report',
      reporter_id: 'reporter-1',
    })).rejects.toThrow('Moderation description must not include unsafe control characters');

    expect((ModerationService as any).flagRepo.findOne).not.toHaveBeenCalled();
    expect((ModerationService as any).flagRepo.create).not.toHaveBeenCalled();
    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe moderator notes before adapter execution or approval persistence', async () => {
    const hide = jest.fn(async () => ({ status: 'hidden', before: true, after: false }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    await expect(ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed\u200Bspam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation moderator_notes must not include unsafe control characters');

    expect((ModerationService as any).flagRepo.findOne).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('rejects malformed adapter mutation evidence before marking flags approved', async () => {
    const hide = jest.fn(async () => ({ status: 'hidden', after: false }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    await expect(ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed spam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation action result before must be present');

    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsupported adapter mutation evidence before marking flags approved', async () => {
    const hide = jest.fn(async () => ({
      status: 'hidden',
      before: true,
      after: false,
      provider_trace_id: 'trace-123',
    }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    await expect(ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed spam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation action result include unsupported field(s): provider_trace_id');

    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe adapter mutation field names before unsupported-key diagnostics', async () => {
    const hide = jest.fn(async () => ({
      status: 'hidden',
      before: true,
      after: false,
      ['provider_trace_id\uFEFF']: 'trace-123',
    }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    await expect(ModerationService.approveFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      action_taken: 'content_hidden',
      moderator_notes: 'confirmed spam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation action result field names contain unsafe control characters');

    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('executes and audits content mutation evidence for bulk approvals', async () => {
    const hide = jest.fn(async () => ({ status: 'hidden', before: { visible: true }, after: { visible: false } }));
    ModerationService.setContentAdapterForTesting('review', { hide });

    const result = await ModerationService.bulkReviewFlags({
      flag_type: 'review',
      target_id: 'review-1',
      admin_user_id: 'admin-1',
      decision: 'approve',
      action_taken: 'content_hidden',
      moderator_notes: 'bulk confirmed spam',
      ip_address: '127.0.0.1',
    });

    expect(hide).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledWith('review-1', {
      actor: 'admin-1',
      reason: 'bulk confirmed spam',
    });
    expect((ModerationService as any).flagRepo.save).toHaveBeenCalledTimes(2);
    expect((ModerationService as any).auditLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'bulk_approve_flags',
      details: expect.objectContaining({
        flag_count: 2,
        action_taken: 'content_hidden',
        content_mutation: expect.objectContaining({
          status: 'hidden',
          flag_type: 'review',
          target_id: 'review-1',
          action: 'content_hidden',
          actor: 'admin-1',
          reason: 'bulk confirmed spam',
          applied: true,
        }),
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      success: true,
      flags_updated: 2,
      content_mutation: expect.objectContaining({ status: 'hidden', applied: true }),
    }));
  });

  it('rejects bulk approval without action evidence before saving any flags', async () => {
    await expect(ModerationService.bulkReviewFlags({
      flag_type: 'review',
      target_id: 'review-1',
      admin_user_id: 'admin-1',
      decision: 'approve',
      action_taken: 'content_hidden',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation action content_hidden is unavailable for review');

    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe bulk moderator notes before loading or mutating flags', async () => {
    await expect(ModerationService.bulkReviewFlags({
      flag_type: 'review',
      target_id: 'review-1',
      admin_user_id: 'admin-1',
      decision: 'approve',
      action_taken: 'content_hidden',
      moderator_notes: '\uFEFFbulk confirmed spam',
      ip_address: '127.0.0.1',
    })).rejects.toThrow('Moderation moderator_notes must not include unsafe control characters');

    expect((ModerationService as any).flagRepo.find).not.toHaveBeenCalled();
    expect((ModerationService as any).flagRepo.save).not.toHaveBeenCalled();
    expect((ModerationService as any).auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('bans reporters who repeatedly submit false flags', async () => {
    (ModerationService as any).flagRepo.count = jest.fn(async () => 5);
    const reporter = { id: 'reporter-1', email: 'reporter@example.com', is_banned: false };
    (ModerationService as any).flagRepo.findOne = jest.fn(async () => ({ ...flag, reporter }));

    await ModerationService.rejectFlag({
      flag_id: 'flag-1',
      admin_user_id: 'admin-1',
      mark_as_false_flag: true,
      ip_address: '127.0.0.1',
    });

    expect((ModerationService as any).userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'reporter-1',
      is_banned: true,
      ban_reason: 'Repeated false content flags',
    }));
  });
});
