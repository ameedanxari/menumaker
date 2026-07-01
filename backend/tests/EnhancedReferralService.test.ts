import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import Fastify from 'fastify';
import { AppDataSource } from '../src/config/database';
import { CustomerReferral, ViralBadge } from '../src/models/EnhancedReferral';
import { Order } from '../src/models/Order';
import { User } from '../src/models/User';
import { enhancedReferralRoutes } from '../src/routes/enhancedReferrals';
import {
  AffiliateService,
  LeaderboardService,
  ViralService,
  buildReferralShareLink,
  calculateAffiliateCommissionCents,
  rankReferralLeaderboardEntries,
  referralLeaderboardMonth,
  startOfReferralLeaderboardMonth,
} from '../src/services/EnhancedReferralService';
import { ReferralService } from '../src/services/ReferralService';

function createRepository<T extends Record<string, any>>(rows: T[] = []) {
  const matchesWhere = (row: T, where: Record<string, any>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  return {
    rows,
    create: jest.fn((input: Partial<T>) => input as T),
    save: jest.fn(async (entity: T) => {
      const index = rows.findIndex((row) => row.id === entity.id);
      if (index >= 0) rows[index] = entity;
      else rows.push(entity);
      return entity;
    }),
    findOne: jest.fn(async (options: { where: Record<string, any> }) => {
      return rows.find((row) => matchesWhere(row, options.where)) ?? null;
    }),
    find: jest.fn(async (options?: { where?: Record<string, any> }) => {
      if (!options?.where) return rows;
      return rows.filter((row) => matchesWhere(row, options.where!));
    }),
    count: jest.fn(async () => rows.length),
  };
}

function claimedReferralRow(overrides: Record<string, any> = {}) {
  return {
    id: 'referral-claimed',
    business_id: 'business-1',
    referrer_id: 'user-a',
    referee_id: 'user-b',
    referee_order_id: 'order-1',
    referral_code: 'CLAIMED',
    status: 'reward_claimed',
    order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
    reward_claimed_at: new Date('2026-06-10T12:05:00.000Z'),
    reward_value_cents: 10000,
    referrer_reward_claimed: true,
    referee_reward_claimed: true,
    ...overrides,
  };
}

describe('ReferralService legacy read-side integrity', () => {
  it('rejects unsafe legacy referral click and signup text before repository access', async () => {
    const getRepository = jest.fn(() => {
      throw new Error('repository should not be read for unsafe referral text');
    });
    AppDataSource.getRepository = getRepository as any;

    await expect(ReferralService.trackClick({
      referral_code: 'REF\u0001CODE',
      source: 'email',
    })).resolves.toMatchObject({
      success: false,
      message: 'Failed to track click',
    });

    await expect(ReferralService.trackClick({
      referral_code: 'REFCODE',
      source: 'email\u0002campaign',
    })).resolves.toMatchObject({
      success: false,
      message: 'Failed to track click',
    });

    await expect(ReferralService.applyReferralOnSignup({
      referral_code: 'REFCODE',
      referee_id: 'user-b',
      referee_email: 'buyer\u0003@example.com',
    })).resolves.toMatchObject({
      success: false,
      message: 'Failed to apply referral',
    });

    expect(getRepository).not.toHaveBeenCalled();
  });

  it('rejects unsafe legacy referral reward and validation identifiers before repository access', async () => {
    const getRepository = jest.fn(() => {
      throw new Error('repository should not be read for unsafe referral identifiers');
    });
    AppDataSource.getRepository = getRepository as any;

    await expect(ReferralService.triggerRewardOnFirstMenu('user\u0004a')).resolves.toMatchObject({
      success: false,
      message: 'Failed to distribute reward',
    });
    await expect(ReferralService.getStats('user\u0005a')).rejects.toThrow(
      'Referral stats user_id contains unsafe control characters'
    );
    await expect(ReferralService.getReferrals('user\u0006a')).rejects.toThrow(
      'Referral list user_id contains unsafe control characters'
    );
    await expect(ReferralService.validateCode('REF\u0007CODE')).rejects.toThrow(
      'Referral validation code contains unsafe control characters'
    );

    expect(getRepository).not.toHaveBeenCalled();
  });

  it('normalizes stats and list queries before reading referral rows', async () => {
    const referralRepo = createRepository<any>([
      {
        id: 'referral-1',
        referrer_id: 'user-a',
        status: 'link_clicked',
        reward_value_cents: 29900,
        reward_claimed: false,
        created_at: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: 'referral-2',
        referrer_id: 'user-a',
        status: 'first_menu_published',
        reward_value_cents: 29900,
        reward_claimed: false,
        created_at: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]);
    AppDataSource.getRepository = jest.fn(() => referralRepo as any) as any;

    await expect(ReferralService.getStats(' user-a ')).resolves.toMatchObject({
      total_referrals: 2,
      link_clicked: 1,
      signup_completed: 1,
      first_menu_published: 1,
      total_rewards_earned_cents: 0,
      conversion_rate: 1,
    });
    expect(referralRepo.find).toHaveBeenCalledWith({ where: { referrer_id: 'user-a' } });

    await ReferralService.getReferrals(' user-a ', '2' as any, '1' as any, ' First_Menu_Published ');
    expect(referralRepo.find).toHaveBeenLastCalledWith({
      where: { referrer_id: 'user-a', status: 'first_menu_published' },
      order: { created_at: 'DESC' },
      take: 2,
      skip: 1,
      relations: ['referee'],
    });
  });

  it('rejects invalid legacy referral list parameters before repository reads', async () => {
    const referralRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn(() => referralRepo as any) as any;

    await expect(ReferralService.getStats('   ')).rejects.toThrow(
      'Referral stats user_id must be a non-empty string'
    );
    await expect(ReferralService.getReferrals('user-a', -1)).rejects.toThrow(
      'Referral list limit must be a non-negative integer'
    );
    await expect(ReferralService.getReferrals('user-a', 10, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(
      'Referral list offset must be a safe integer'
    );
    await expect(ReferralService.getReferrals('user-a', 10, 0, 'reward_claimed')).rejects.toThrow(
      'Referral list status must be link_clicked, signup_completed, first_menu_published, or expired'
    );

    expect(referralRepo.find).not.toHaveBeenCalled();
  });

  it('rejects corrupt persisted legacy referral rows before returning stats or lists', async () => {
    const cases = [
      {
        row: {
          id: 'referral-corrupt-status',
          referrer_id: 'user-a',
          status: 'reward_claimed',
          reward_value_cents: 29900,
          reward_claimed: true,
        },
        message:
          'Referral row 1 status for referral referral-corrupt-status must be link_clicked, signup_completed, first_menu_published, or expired',
      },
      {
        row: {
          id: 'referral-corrupt-reward',
          referrer_id: 'user-a',
          status: 'first_menu_published',
          reward_value_cents: 'not-a-number',
          reward_claimed: false,
        },
        message:
          'Reward value for referral referral-corrupt-reward must be a non-negative integer amount in cents',
      },
      {
        row: {
          id: 'referral-corrupt-flag',
          referrer_id: 'user-a',
          status: 'first_menu_published',
          reward_value_cents: 29900,
          reward_claimed: 'yes',
        },
        message:
          'Referral row 1 reward_claimed for referral referral-corrupt-flag must be a boolean',
      },
      {
        row: {
          id: 'referral-corrupt-date',
          referrer_id: 'user-a',
          status: 'signup_completed',
          reward_value_cents: 29900,
          reward_claimed: false,
          signup_completed_at: 'not-a-date',
        },
        message:
          'Referral row 1 signup_completed_at for referral referral-corrupt-date must be a valid Date',
      },
      {
        row: {
          id: 'referral-cross-user',
          referrer_id: 'user-b',
          status: 'link_clicked',
          reward_value_cents: 29900,
          reward_claimed: false,
        },
        message:
          'Referral row 1 referrer_id must match requested user for referral referral-cross-user',
      },
      {
        row: {
          id: 'referral-unsafe-source',
          referrer_id: 'user-a',
          status: 'link_clicked',
          reward_value_cents: 29900,
          reward_claimed: false,
          source: 'email\u0001campaign',
        },
        message:
          'Referral row 1 source for referral referral-unsafe-source contains unsafe control characters',
      },
      {
        row: {
          id: 'referral-provider-metadata',
          referrer_id: 'user-a',
          status: 'link_clicked',
          reward_value_cents: 29900,
          reward_claimed: false,
          provider_trace_id: 'trace-123',
        },
        message:
          'Referral row 1 for referral referral-provider-metadata include unsupported field(s): provider_trace_id',
      },
    ];

    for (const { row, message } of cases) {
      const referralRepo = {
        find: jest.fn(async () => [row]),
      };
      AppDataSource.getRepository = jest.fn(() => referralRepo as any) as any;

      await expect(ReferralService.getStats('user-a')).rejects.toThrow(message);
      await expect(ReferralService.getReferrals('user-a')).rejects.toThrow(message);
    }
  });

  it('rejects duplicate completed legacy referral evidence before returning stats or lists', async () => {
    const referralRows = [
      {
        id: 'referral-1',
        referrer_id: 'user-a',
        referee_id: 'user-b',
        status: 'signup_completed',
        reward_value_cents: 29900,
        reward_claimed: false,
      },
      {
        id: 'referral-2',
        referrer_id: 'user-a',
        referee_id: 'user-b',
        status: 'first_menu_published',
        reward_value_cents: 29900,
        reward_claimed: false,
      },
    ];
    const referralRepo = {
      find: jest.fn(async () => referralRows),
    };
    AppDataSource.getRepository = jest.fn(() => referralRepo as any) as any;

    await expect(ReferralService.getStats('user-a')).rejects.toThrow(
      'Referral row 2 referee_id must be unique for completed referral evidence'
    );
    await expect(ReferralService.getReferrals('user-a')).rejects.toThrow(
      'Referral row 2 referee_id must be unique for completed referral evidence'
    );
  });

  it('rejects unsafe generated-code source email and unsafe validation result email', async () => {
    AppDataSource.getRepository = jest.fn(() => createRepository<any>()) as any;
    await expect(ReferralService.generateReferralCode({
      id: 'user-a',
      email: 'seller\u0001@example.com',
    } as any)).rejects.toThrow('Referral user email contains unsafe control characters');

    const userRepo = createRepository<any>([
      {
        id: 'user-a',
        referral_code: 'REFCODE',
        email: 'seller\u0002@example.com',
      },
    ]);
    AppDataSource.getRepository = jest.fn(() => userRepo as any) as any;

    await expect(ReferralService.validateCode('REFCODE')).rejects.toThrow(
      'Referral validation referrer email contains unsafe control characters'
    );
  });
});

describe('EnhancedReferralService disabled capability boundary', () => {
  it('fails enhanced referral service calls before repository side effects by default', async () => {
    const leaderboardRepository = createRepository<any>();
    const referralRepository = createRepository<any>();
    const affiliateRepository = createRepository<any>();
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const viralReferralRepository = createRepository<any>();
    const badgeRepository = createRepository<any>();

    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return viralReferralRepository;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepository;
      if (entity === User || entity?.name === 'User') return userRepository;
      return createRepository();
    }) as any;

    const leaderboardService = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: referralRepository as any,
      userRepository: userRepository as any,
    });
    const affiliateService = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: userRepository as any,
    });
    const viralService = new ViralService();

    await expect(leaderboardService.updateLeaderboard('user-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(leaderboardService.getTopReferrers()).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(leaderboardService.getUserPosition('user-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(leaderboardService.distributePrizes('2026-06')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });

    await expect(affiliateService.applyForAffiliate('user-1', {
      application_message: 'I write about independent restaurants and want to join the launch affiliate program.',
    })).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.approveAffiliate('affiliate-1', 'admin-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.trackClick('BLOGGER', {})).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.trackConversion('click-1', 'user-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.calculateCommission('affiliate-1', 10_000, 'seller')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.getAffiliateDashboard('user-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(affiliateService.processMonthlyPayouts('2026-06')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });

    await expect(
      viralService.createCustomerReferral('user-1', 'business-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(
      viralService.trackReferralOrder('CUST123', 'user-2', 'order-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(
      viralService.claimReferralRewards('referral-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(
      viralService.getCustomerReferralStats('user-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(
      viralService.checkAndAwardBadges('user-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    await expect(
      viralService.getUserBadges('user-1')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    });
    expect(() =>
      viralService.generateInstagramStoryShare('CUST123', 'Cafe Blue')
    ).toThrow(expect.objectContaining({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    }));
    expect(() =>
      viralService.generateWhatsAppShare('CUST123', 'Cafe Blue')
    ).toThrow(expect.objectContaining({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'enhanced_referrals_affiliates',
    }));

    expect(referralRepository.count).not.toHaveBeenCalled();
    expect(referralRepository.find).not.toHaveBeenCalled();
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
    expect(leaderboardRepository.find).not.toHaveBeenCalled();
    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.find).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(clickRepository.findOne).not.toHaveBeenCalled();
    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(viralReferralRepository.find).not.toHaveBeenCalled();
    expect(viralReferralRepository.findOne).not.toHaveBeenCalled();
    expect(viralReferralRepository.create).not.toHaveBeenCalled();
    expect(viralReferralRepository.save).not.toHaveBeenCalled();
    expect(badgeRepository.find).not.toHaveBeenCalled();
    expect(badgeRepository.findOne).not.toHaveBeenCalled();
    expect(badgeRepository.save).not.toHaveBeenCalled();
  });

  it('returns FEATURE_UNAVAILABLE from direct route-plugin registration before service construction', async () => {
    const app = Fastify({ logger: false });
    const originalGetRepository = AppDataSource.getRepository;
    AppDataSource.getRepository = jest.fn(() => {
      throw new Error('repositories should not be constructed while enhanced referrals are disabled');
    }) as any;

    try {
      await app.register(enhancedReferralRoutes);

      const leaderboard = await app.inject({
        method: 'GET',
        url: '/referrals/leaderboard',
      });
      const affiliateClick = await app.inject({
        method: 'POST',
        url: '/affiliates/track/BLOGGER',
      });

      for (const response of [leaderboard, affiliateClick]) {
        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
          success: false,
          error: {
            code: 'FEATURE_UNAVAILABLE',
            capability: 'enhanced_referrals_affiliates',
          },
        });
      }

      expect(AppDataSource.getRepository).not.toHaveBeenCalled();
    } finally {
      AppDataSource.getRepository = originalGetRepository;
      await app.close();
    }
  });
});

describe('EnhancedReferralService reward claiming', () => {
  let savedReferral: any;
  let outbox: any[];

  beforeEach(() => {
    savedReferral = null;
    outbox = [];
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-1',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referee_id: 'user-b',
        referee_order_id: 'order-1',
        referral_code: 'CUST123',
        status: 'order_placed',
        order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
        reward_value_cents: 10000,
        referrer_reward_claimed: false,
        referee_reward_claimed: false,
      })),
      save: jest.fn(async (record) => {
        savedReferral = record;
        return record;
      }),
    };
    const badgeRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    const userRepo = { findOne: jest.fn() };

    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      if (entity === User || entity?.name === 'User') return userRepo;
      return referralRepo;
    }) as any;

    ViralService.setRewardDependenciesForTesting({
      now: () => new Date('2026-06-20T00:00:00.000Z'),
      couponService: {
        createCoupon: jest.fn(async (_businessId: string, data: any) => ({
          id: `coupon-${data.code}`,
          business_id: _businessId,
          ...data,
        })),
      },
      outboxRepository: {
        findOne: jest.fn(async () => null),
        save: jest.fn(async (record: any) => {
          outbox.push(record);
          return record;
        }),
      },
    });
  });

  it('rejects blank viral referral identifiers before repository reads or writes', async () => {
    const referralRepo = createRepository<any>();
    const badgeRepo = createRepository<any>();
    const userRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      if (entity === User || entity?.name === 'User') return userRepo;
      return createRepository();
    }) as any;
    const service = new ViralService({ enforceCapability: false });

    await expect(service.createCustomerReferral('   ', 'business-1')).rejects.toThrow(
      'Customer referral user_id must be a non-empty string'
    );
    await expect(service.createCustomerReferral('user-1', '   ')).rejects.toThrow(
      'Customer referral business_id must be a non-empty string'
    );
    await expect(service.trackReferralOrder('   ', 'user-b', 'order-1')).rejects.toThrow(
      'Customer referral code must be a non-empty string'
    );
    await expect(service.trackReferralOrder('CUST123', '   ', 'order-1')).rejects.toThrow(
      'Customer referral referee_id must be a non-empty string'
    );
    await expect(service.trackReferralOrder('CUST123', 'user-b', '   ')).rejects.toThrow(
      'Customer referral order_id must be a non-empty string'
    );
    await expect(service.claimReferralRewards('   ')).rejects.toThrow(
      'Customer referral id must be a non-empty string'
    );
    await expect(service.getCustomerReferralStats('   ')).rejects.toThrow(
      'Customer referral stats user_id must be a non-empty string'
    );
    await expect(service.checkAndAwardBadges('   ')).rejects.toThrow(
      'Viral badge user_id must be a non-empty string'
    );
    await expect(service.getUserBadges('   ')).rejects.toThrow(
      'Viral badge user_id must be a non-empty string'
    );
    expect(() => service.generateInstagramStoryShare('   ', 'Cafe Blue')).toThrow(
      'Referral code must be a non-empty string'
    );
    expect(() => service.generateInstagramStoryShare('CUST123', '   ')).toThrow(
      'Referral share business name must be a non-empty string'
    );
    expect(() => service.generateInstagramStoryShare('CUST123', 'Cafe Blue', 'javascript:alert(1)')).toThrow(
      'Referral share menu preview URL must be an absolute HTTP(S) URL'
    );
    expect(() => service.generateWhatsAppShare('   ', 'Cafe Blue')).toThrow(
      'Referral code must be a non-empty string'
    );
    expect(() => service.generateWhatsAppShare('CUST123', '   ')).toThrow(
      'Referral share business name must be a non-empty string'
    );

    expect(referralRepo.findOne).not.toHaveBeenCalled();
    expect(referralRepo.find).not.toHaveBeenCalled();
    expect(referralRepo.create).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(badgeRepo.findOne).not.toHaveBeenCalled();
    expect(badgeRepo.find).not.toHaveBeenCalled();
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('normalizes viral referral identifiers before lookup, persistence, stats, badges, and share output', async () => {
    const referralRecord: any = {
      id: 'referral-1',
      business_id: 'business-1',
      referrer_id: 'user-a',
      referral_code: 'CUST123',
      status: 'link_clicked',
      reward_value_cents: 10000,
      referrer_reward_claimed: false,
      referee_reward_claimed: false,
    };
    const referralRepo = createRepository<any>([
      referralRecord,
      ...Array.from({ length: 10 }, (_, index) => claimedReferralRow({
        id: `rewarded-referral-${index + 1}`,
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: `REWARDED${index + 1}`,
        reward_value_cents: 10000,
      })),
    ]);
    const badgeRepo = createRepository<any>([
      { id: 'badge-1', user_id: 'user-a', badge_type: 'superstar', tier: 1 },
    ]);
    const userRepo = createRepository<any>([
      { id: 'user-a', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const orderRepo = createRepository<any>([
      {
        id: 'order-1',
        business_id: 'business-1',
        customer_id: 'user-b',
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      if (entity === User || entity?.name === 'User') return userRepo;
      if (entity === Order || entity?.name === 'Order') return orderRepo;
      return createRepository();
    }) as any;
    const service = new ViralService({ enforceCapability: false });

    const created = await service.createCustomerReferral(' user-a ', ' business-1 ');
    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-a' } });
    expect(created).toMatchObject({
      business_id: 'business-1',
      referrer_id: 'user-a',
      status: 'link_clicked',
    });

    await service.trackReferralOrder(' CUST123 ', ' user-b ', ' order-1 ');
    expect(referralRepo.findOne).toHaveBeenCalledWith({ where: { referral_code: 'CUST123' } });
    expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
    expect(referralRecord).toMatchObject({
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      status: 'order_placed',
    });

    referralRecord.status = 'reward_claimed';
    referralRecord.referrer_reward_claimed = true;
    referralRecord.referee_reward_claimed = true;
    referralRecord.reward_claimed_at = new Date(referralRecord.order_placed_at.getTime() + 60_000);
    await expect(service.claimReferralRewards(' referral-1 ')).resolves.toMatchObject({
      status: 'already_claimed',
    });
    expect(referralRepo.findOne).toHaveBeenCalledWith({ where: { id: 'referral-1' } });

    await service.getCustomerReferralStats(' user-a ');
    expect(referralRepo.find).toHaveBeenCalledWith({ where: { referrer_id: 'user-a' } });

    await service.checkAndAwardBadges(' user-a ');
    expect(referralRepo.find).toHaveBeenCalledWith({
      where: { referrer_id: 'user-a', status: 'reward_claimed' },
    });
    expect(badgeRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-a', badge_type: 'superstar' },
    });

    await service.getUserBadges(' user-a ');
    expect(badgeRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-a' },
      order: { tier: 'DESC' },
    });

    expect(buildReferralShareLink(' cust 123 ')).toBe('https://menumaker.app?ref=CUST+123');
    const instagram = service.generateInstagramStoryShare(' cust123 ', ' Cafe Blue ', ' https://cdn.example/menu.png ');
    expect(instagram.story_template).toMatchObject({
      background_image: 'https://cdn.example/menu.png',
      link: 'https://menumaker.app?ref=CUST123',
      text: 'Join Cafe Blue on MenuMaker with referral code CUST123. Launch rewards are shown in the app when available.',
    });
    const whatsapp = service.generateWhatsAppShare(' cust123 ', ' Cafe Blue ');
    expect(whatsapp.message).toContain('MenuMaker for Cafe Blue');
    expect(whatsapp.message).toContain('Use code: CUST123');
  });

  it('rejects mismatched customer referral user lookup rows before creating referral codes', async () => {
    const referralRepo = createRepository<any>();
    const badgeRepo = createRepository<any>();
    const userRepo = {
      findOne: jest.fn(async () => ({
        id: 'user-elsewhere',
        email: 'elsewhere@example.com',
        full_name: 'Else Where',
      })),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      if (entity === User || entity?.name === 'User') return userRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).createCustomerReferral('user-a', 'business-1')
    ).rejects.toThrow('Customer referral user row id must match requested user');

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-a' } });
    expect(referralRepo.create).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
  });

  it('creates ledger entries, coupons, and notification outbox records atomically around a reward claim', async () => {
    const result = await new ViralService({ enforceCapability: false }).claimReferralRewards('referral-1');

    expect(result.status).toBe('claimed');
    expect(result.ledger_entries).toHaveLength(2);
    expect(result.coupons.map((coupon: any) => coupon.code)).toEqual(['REF-CUST123-A', 'REF-CUST123-B']);
    expect(result.notifications).toHaveLength(2);
    expect(outbox.map((record) => record.deduplication_key)).toEqual([
      'referral:referral-1:referrer:reward',
      'referral:referral-1:referee:reward',
    ]);
    expect(savedReferral.status).toBe('reward_claimed');
    expect(savedReferral.referrer_reward_claimed).toBe(true);
  });

  it('rejects invalid referral reward amounts before coupons, notifications, or ledger writes', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-invalid',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referee_id: 'user-b',
        referral_code: 'CUST123',
        status: 'order_placed',
        reward_value_cents: -1,
        referrer_reward_claimed: false,
        referee_reward_claimed: false,
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;
    const couponService = {
      createCoupon: jest.fn(async () => ({ id: 'coupon-1' })),
    };
    const outboxRepository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (record: any) => record),
    };
    ViralService.setRewardDependenciesForTesting({
      couponService,
      outboxRepository,
    });

    await expect(
      new ViralService({ enforceCapability: false }).claimReferralRewards('referral-invalid')
    ).rejects.toThrow('Referral reward value for referral referral-invalid must be a non-negative integer amount in cents');

    expect(couponService.createCoupon).not.toHaveBeenCalled();
    expect(outboxRepository.save).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(ViralService.getRewardLedgerForTesting('referral-invalid')).toEqual([]);
  });

  it('rejects stale referral reward notification dedupe rows before reward side effects', async () => {
    const cases = [
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-other',
          recipient_ref: 'user-a',
          payload: {
            referral_id: 'referral-other',
            coupon_code: 'REF-DEDUPE-A',
            reward_cents: 10000,
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward aggregate_id must match reward intent',
      },
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-dedupe',
          recipient_ref: 'user-c',
          payload: {
            referral_id: 'referral-dedupe',
            coupon_code: 'REF-DEDUPE-A',
            reward_cents: 10000,
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward recipient_ref must match reward participant',
      },
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-dedupe',
          recipient_ref: 'user-a',
          payload: {
            referral_id: 'referral-dedupe',
            coupon_code: 'REF-OTHER-A',
            reward_cents: 10000,
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward payload coupon_code must match reward coupon',
      },
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-dedupe',
          recipient_ref: 'user-a',
          payload: {
            referral_id: 'referral-dedupe',
            coupon_code: 'REF-DEDUPE-A',
            reward_cents: 25000,
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward payload reward_cents must match reward value',
      },
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-dedupe',
          recipient_ref: 'user-a',
          payload: {
            referral_id: 'referral-dedupe',
            coupon_code: 'REF-DEDUPE-A',
            reward_cents: 10000,
            provider_trace_id: 'trace-123',
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward payload include unsupported field(s): provider_trace_id',
      },
      {
        existingNotification: {
          channel: 'email',
          template: 'referral_reward_claimed',
          deduplication_key: 'referral:referral-dedupe:referrer:reward',
          aggregate_type: 'customer_referral',
          aggregate_id: 'referral-dedupe',
          recipient_ref: 'user-a',
          payload: {
            referral_id: 'referral-dedupe',
            coupon_code: 'REF-DEDUPE-A',
            reward_cents: 10000,
            ['provider_trace_id\uFEFF']: 'trace-123',
          },
        },
        message:
          'Referral reward notification referral:referral-dedupe:referrer:reward payload field names must not include unsafe control characters',
      },
    ];

    for (const { existingNotification, message } of cases) {
      const referralRepo = {
        findOne: jest.fn(async () => ({
          id: 'referral-dedupe',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'DEDUPE',
          status: 'order_placed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        })),
        save: jest.fn(async (record) => record),
      };
      AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
        if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
        return createRepository();
      }) as any;
      const couponService = {
        createCoupon: jest.fn(async () => ({ id: 'coupon-1' })),
      };
      const outboxRepository = {
        findOne: jest.fn(async (options: any) => {
          if (
            options?.where?.deduplication_key === 'referral:referral-dedupe:referrer:reward' &&
            options?.where?.channel === 'email'
          ) {
            return existingNotification;
          }
          return null;
        }),
        save: jest.fn(async (record: any) => record),
      };
      ViralService.setRewardDependenciesForTesting({
        couponService,
        outboxRepository,
      });

      await expect(
        new ViralService({ enforceCapability: false }).claimReferralRewards('referral-dedupe')
      ).rejects.toThrow(message);

      expect(couponService.createCoupon).not.toHaveBeenCalled();
      expect(outboxRepository.save).not.toHaveBeenCalled();
      expect(referralRepo.save).not.toHaveBeenCalled();
      expect(ViralService.getRewardLedgerForTesting('referral-dedupe')).toEqual([]);
    }
  });

  it('rejects corrupt persisted reward-claim rows before already-claimed or side effects', async () => {
    const cases = [
      {
        row: [] as any,
        message: 'Customer referral must be an object',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-other',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'order_placed',
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-other id must match requested referral',
        ledgerId: 'referral-other',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'rewarded-but-not-really',
          reward_value_cents: 10000,
          referrer_reward_claimed: true,
          referee_reward_claimed: true,
        },
        message: 'Customer referral referral-requested status must be link_clicked, order_placed, or reward_claimed',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'order_placed',
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
          created_at: '2026-06-10T12:00:00.000Z',
        },
        message: 'Customer referral referral-requested created_at must be a valid Date',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'order_placed',
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
          created_at: new Date('2026-06-10T12:00:00.000Z'),
          updated_at: new Date('2026-06-10T11:59:59.000Z'),
        },
        message: 'Customer referral referral-requested updated_at cannot be before created_at',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'reward_claimed',
          reward_value_cents: 10000,
          referrer_reward_claimed: 'yes',
          referee_reward_claimed: true,
        },
        message: 'Customer referral referral-requested referrer_reward_claimed must be a boolean',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'CUST123',
          status: 'order_placed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: true,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-requested reward claim flags must be consistent',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'CUST123',
          status: 'order_placed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: true,
          referee_reward_claimed: true,
        },
        message: 'Customer referral referral-requested reward flags cannot be claimed before reward_claimed status',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'reward_claimed',
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-requested reward flags must both be claimed for reward_claimed status',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'CUST123',
          status: 'reward_claimed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: true,
          referee_reward_claimed: true,
        },
        message: 'Customer referral referral-requested reward_claimed_at is required for reward_claimed status',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'CUST123',
          status: 'reward_claimed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_claimed_at: new Date('2026-06-10T11:59:59.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: true,
          referee_reward_claimed: true,
        },
        message: 'Customer referral referral-requested reward_claimed_at cannot be before order_placed_at',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: '   ',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'order_placed',
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-requested business_id must be a non-empty string',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referral_code: 'CUST123',
          status: 'order_placed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-requested referee_order_id must be a non-empty string',
        ledgerId: 'referral-requested',
      },
      {
        row: {
          id: 'referral-requested',
          business_id: 'business-1',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          referral_code: 'CUST123',
          status: 'order_placed',
          order_placed_at: new Date('not-a-real-date'),
          reward_value_cents: 10000,
          referrer_reward_claimed: false,
          referee_reward_claimed: false,
        },
        message: 'Customer referral referral-requested order_placed_at must be a valid Date',
        ledgerId: 'referral-requested',
      },
    ];

    for (const { row, message, ledgerId } of cases) {
      const referralRepo = {
        findOne: jest.fn(async () => row),
        save: jest.fn(async (record) => record),
      };
      AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
        if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
        return createRepository();
      }) as any;
      const couponService = {
        createCoupon: jest.fn(async () => ({ id: 'coupon-1' })),
      };
      const outboxRepository = {
        findOne: jest.fn(async () => null),
        save: jest.fn(async (record: any) => record),
      };
      ViralService.setRewardDependenciesForTesting({
        couponService,
        outboxRepository,
      });

      await expect(
        new ViralService({ enforceCapability: false }).claimReferralRewards('referral-requested')
      ).rejects.toThrow(message);

      expect(couponService.createCoupon).not.toHaveBeenCalled();
      expect(outboxRepository.save).not.toHaveBeenCalled();
      expect(referralRepo.save).not.toHaveBeenCalled();
      expect(ViralService.getRewardLedgerForTesting(ledgerId)).toEqual([]);
    }
  });

  it('rejects self-referral reward claims before side effects', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-self',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referee_id: 'user-a',
        referee_order_id: 'order-self',
        referral_code: 'SELF123',
        status: 'order_placed',
        order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
        reward_value_cents: 10000,
        referrer_reward_claimed: false,
        referee_reward_claimed: false,
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;
    const couponService = {
      createCoupon: jest.fn(async () => ({ id: 'coupon-1' })),
    };
    const outboxRepository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (record: any) => record),
    };
    ViralService.setRewardDependenciesForTesting({
      couponService,
      outboxRepository,
    });

    await expect(
      new ViralService({ enforceCapability: false }).claimReferralRewards('referral-self')
    ).rejects.toThrow('Self-referrals cannot claim rewards');

    expect(couponService.createCoupon).not.toHaveBeenCalled();
    expect(outboxRepository.save).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(ViralService.getRewardLedgerForTesting('referral-self')).toEqual([]);
  });

  it('rejects self-referral order tracking before saving referral state', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-self-order',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: 'SELFORDER',
        status: 'link_clicked',
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder('SELFORDER', 'user-a', 'order-1')
    ).rejects.toThrow('Self-referrals cannot be linked to orders');

    expect(referralRepo.save).not.toHaveBeenCalled();
  });

  it('rejects mismatched referral-code rows during order tracking before saving referral state', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-wrong-code',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: 'OTHER-CODE',
        status: 'link_clicked',
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder('CORRUPTORDER', 'user-b', 'order-1')
    ).rejects.toThrow(
      'Customer referral referral-wrong-code referral_code must match requested referral code'
    );

    expect(referralRepo.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt referral status during order tracking before saving referral state', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-corrupt-order',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: 'CORRUPTORDER',
        status: 'linked-but-corrupt',
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder('CORRUPTORDER', 'user-b', 'order-1')
    ).rejects.toThrow(
      'Customer referral referral-corrupt-order status must be link_clicked, order_placed, or reward_claimed'
    );

    expect(referralRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsupported customer referral order fields before order lookup or saving state', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-provider-order',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: 'PROVIDERORDER',
        status: 'link_clicked',
        provider_trace_id: 'trace-123',
      })),
      save: jest.fn(async (record) => record),
    };
    const orderRepo = createRepository<any>([
      {
        id: 'order-1',
        business_id: 'business-1',
        customer_id: 'user-b',
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === Order || entity?.name === 'Order') return orderRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder('PROVIDERORDER', 'user-b', 'order-1')
    ).rejects.toThrow(
      'Customer referral referral-provider-order include unsupported field(s): provider_trace_id'
    );

    expect(orderRepo.findOne).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
  });

  it('treats exact referral order replays as idempotent without rewriting referral state', async () => {
    const referral = {
      id: 'referral-idempotent-order',
      business_id: 'business-1',
      referrer_id: 'user-a',
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      referral_code: 'IDEMPOTENTORDER',
      status: 'order_placed',
      order_placed_at: new Date('2026-06-01T00:00:00.000Z'),
    };
    const referralRepo = {
      findOne: jest.fn(async () => referral),
      save: jest.fn(async (record) => record),
    };
    const orderRepo = createRepository<any>([
      {
        id: 'order-1',
        business_id: 'business-1',
        customer_id: 'user-b',
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === Order || entity?.name === 'Order') return orderRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder(
        'IDEMPOTENTORDER',
        'user-b',
        'order-1'
      )
    ).resolves.toBe(referral);

    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
    expect(referral).toMatchObject({
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      status: 'order_placed',
      order_placed_at: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('rejects conflicting referral order replays before overwriting linked order state', async () => {
    const referral = {
      id: 'referral-conflicting-order',
      business_id: 'business-1',
      referrer_id: 'user-a',
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      referral_code: 'CONFLICTORDER',
      status: 'order_placed',
      order_placed_at: new Date('2026-06-01T00:00:00.000Z'),
    };
    const referralRepo = {
      findOne: jest.fn(async () => referral),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder(
        'CONFLICTORDER',
        'user-c',
        'order-2'
      )
    ).rejects.toThrow('Customer referral referral-conflicting-order already has a linked order');

    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(referral).toMatchObject({
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      status: 'order_placed',
      order_placed_at: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('rejects claimed referral rows during order tracking before downgrading reward state', async () => {
    const referral = {
      id: 'referral-claimed-order',
      business_id: 'business-1',
      referrer_id: 'user-a',
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      referral_code: 'CLAIMEDORDER',
      status: 'reward_claimed',
      order_placed_at: new Date('2026-06-01T00:00:00.000Z'),
      reward_claimed_at: new Date('2026-06-01T00:05:00.000Z'),
      referrer_reward_claimed: true,
      referee_reward_claimed: true,
    };
    const referralRepo = {
      findOne: jest.fn(async () => referral),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder(
        'CLAIMEDORDER',
        'user-b',
        'order-1'
      )
    ).rejects.toThrow('Customer referral referral-claimed-order already has claimed rewards');

    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(referral).toMatchObject({
      referee_id: 'user-b',
      referee_order_id: 'order-1',
      status: 'reward_claimed',
      referrer_reward_claimed: true,
      referee_reward_claimed: true,
    });
  });

  it('rejects inconsistent referral order fields before saving referral state', async () => {
    const referral = {
      id: 'referral-inconsistent-order',
      business_id: 'business-1',
      referrer_id: 'user-a',
      referee_id: 'user-b',
      referral_code: 'INCONSISTENTORDER',
      status: 'link_clicked',
    };
    const referralRepo = {
      findOne: jest.fn(async () => referral),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).trackReferralOrder(
        'INCONSISTENTORDER',
        'user-b',
        'order-1'
      )
    ).rejects.toThrow('Customer referral referral-inconsistent-order has inconsistent order tracking state');

    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(referral).toMatchObject({
      referee_id: 'user-b',
      status: 'link_clicked',
    });
  });

  it('rejects missing or mismatched referral order source rows before saving referral state', async () => {
    const cases: Array<{
      name: string;
      order: any;
      expectedError: string;
    }> = [
      {
        name: 'missing order row',
        order: null,
        expectedError: 'Customer referral order not found',
      },
      {
        name: 'cross-business order',
        order: { id: 'order-1', business_id: 'business-elsewhere', customer_id: 'user-b' },
        expectedError: 'Customer referral order business_id must match referral business_id',
      },
      {
        name: 'cross-customer order',
        order: { id: 'order-1', business_id: 'business-1', customer_id: 'user-c' },
        expectedError: 'Customer referral order customer_id must match referral referee_id',
      },
      {
        name: 'missing customer evidence',
        order: { id: 'order-1', business_id: 'business-1', customer_id: null },
        expectedError: 'Customer referral order order-1 customer_id must be a non-empty string',
      },
      {
        name: 'drifted business relation',
        order: {
          id: 'order-1',
          business_id: 'business-1',
          customer_id: 'user-b',
          business: { id: 'business-elsewhere' },
        },
        expectedError: 'Customer referral order business relation id must match order business_id',
      },
    ];

    for (const { order, expectedError } of cases) {
      const referral = {
        id: 'referral-order-source',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referral_code: 'ORDERSOURCE',
        status: 'link_clicked',
      };
      const referralRepo = {
        findOne: jest.fn(async () => referral),
        save: jest.fn(async (record) => record),
      };
      const orderRepo = {
        findOne: jest.fn(async () => order),
      };
      AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
        if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
        if (entity === Order || entity?.name === 'Order') return orderRepo;
        return createRepository();
      }) as any;

      await expect(
        new ViralService({ enforceCapability: false }).trackReferralOrder(
          'ORDERSOURCE',
          'user-b',
          'order-1'
        )
      ).rejects.toThrow(expectedError);

      expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
      expect(referralRepo.save).not.toHaveBeenCalled();
      expect(referral).toMatchObject({ status: 'link_clicked' });
      expect(referral).not.toHaveProperty('referee_id');
      expect(referral).not.toHaveProperty('referee_order_id');
    }
  });

  it('rejects invalid reward clocks before coupons, notifications, or ledger writes', async () => {
    const referralRepo = {
      findOne: jest.fn(async () => ({
        id: 'referral-invalid-clock',
        business_id: 'business-1',
        referrer_id: 'user-a',
        referee_id: 'user-b',
        referee_order_id: 'order-1',
        referral_code: 'CUST123',
        status: 'order_placed',
        order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
        reward_value_cents: 10000,
        referrer_reward_claimed: false,
        referee_reward_claimed: false,
      })),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;
    const couponService = {
      createCoupon: jest.fn(async () => ({ id: 'coupon-1' })),
    };
    const outboxRepository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (record: any) => record),
    };
    ViralService.setRewardDependenciesForTesting({
      now: () => new Date('not-a-real-date'),
      couponService,
      outboxRepository,
    });

    await expect(
      new ViralService({ enforceCapability: false }).claimReferralRewards('referral-invalid-clock')
    ).rejects.toThrow('Referral reward clock must be a valid Date');

    expect(couponService.createCoupon).not.toHaveBeenCalled();
    expect(outboxRepository.save).not.toHaveBeenCalled();
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(ViralService.getRewardLedgerForTesting('referral-invalid-clock')).toEqual([]);
  });

  it('calculates referral stats from recorded reward cents instead of a fixed reward assumption', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-claimed-1',
        referrer_id: 'user-a',
        reward_value_cents: 7500,
      }),
      claimedReferralRow({
        id: 'referral-claimed-2',
        referrer_id: 'user-a',
        reward_value_cents: 12500,
      }),
      {
        id: 'referral-pending',
        referrer_id: 'user-a',
        referee_id: 'user-pending',
        referee_order_id: 'order-pending',
        status: 'order_placed',
        order_placed_at: new Date('2026-06-10T12:10:00.000Z'),
        reward_value_cents: 25000,
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).resolves.toEqual({
      total_referrals: 3,
      successful_referrals: 2,
      total_rewards_earned: 200,
    });
  });

  it('rejects cross-user customer referral stats rows before returning reward totals', async () => {
    const referralRepo = {
      find: jest.fn(async () => [
        {
          id: 'referral-cross-user',
          referrer_id: 'user-b',
          status: 'reward_claimed',
          reward_value_cents: 7500,
        },
      ]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral stats row 1 referrer_id must match requested user for referral referral-cross-user'
    );
    expect(referralRepo.find).toHaveBeenCalledWith({ where: { referrer_id: 'user-a' } });
  });

  it('rejects malformed customer referral stats row envelopes before returning reward totals', async () => {
    const referralRepo = {
      find: jest.fn(async () => [[] as any]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow('Customer referral stats row 1 must be an object');
    expect(referralRepo.find).toHaveBeenCalledWith({ where: { referrer_id: 'user-a' } });
  });

  it('rejects corrupt claimed referral reward values before returning stats', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-corrupt',
        referrer_id: 'user-a',
        reward_value_cents: 'not-a-number',
      }),
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow('Referral reward value for referral referral-corrupt must be a non-negative integer amount in cents');
  });

  it('rejects claimed referral rows without order evidence before stats or badge progress', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-missing-order-evidence',
        referrer_id: 'user-a',
        order_placed_at: undefined,
      }),
    ]);
    const badgeRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral referral-missing-order-evidence order_placed_at must be a valid Date'
    );
    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow(
      'Customer referral referral-missing-order-evidence order_placed_at must be a valid Date'
    );
    expect(badgeRepo.findOne).not.toHaveBeenCalled();
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it('rejects claimed referral rows without reward-claim timestamps before stats or badge progress', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-missing-claim-time',
        referrer_id: 'user-a',
        reward_claimed_at: undefined,
      }),
    ]);
    const badgeRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral referral-missing-claim-time reward_claimed_at is required for reward_claimed status'
    );
    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow(
      'Customer referral referral-missing-claim-time reward_claimed_at is required for reward_claimed status'
    );
    expect(badgeRepo.findOne).not.toHaveBeenCalled();
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt customer referral statuses before returning stats', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-valid',
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }),
      {
        id: 'referral-corrupt-status',
        referrer_id: 'user-a',
        status: 'rewarded-but-not-really',
        reward_value_cents: 10000,
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral referral-corrupt-status status must be link_clicked, order_placed, or reward_claimed'
    );
  });

  it('rejects duplicate customer referral stats ids before returning reward totals', async () => {
    const referralRepo = createRepository<any>([
      claimedReferralRow({
        id: 'referral-duplicate',
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }),
      claimedReferralRow({
        id: 'referral-duplicate',
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }),
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral stats row 2 id must be unique for user user-a'
    );
  });

  it('rejects unsupported customer referral stats fields before returning reward totals', async () => {
    const referralRepo = createRepository<any>([
      {
        id: 'referral-provider-stats',
        referrer_id: 'user-a',
        status: 'reward_claimed',
        reward_value_cents: 10000,
        provider_trace_id: 'trace-123',
      },
    ]);
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral stats row 1 include unsupported field(s): provider_trace_id'
    );

    referralRepo.rows[0] = {
      id: 'referral-provider-stats',
      referrer_id: 'user-a',
      status: 'reward_claimed',
      reward_value_cents: 10000,
      ['provider_trace_id\uFEFF']: 'trace-123',
    };

    await expect(
      new ViralService({ enforceCapability: false }).getCustomerReferralStats('user-a')
    ).rejects.toThrow(
      'Customer referral stats row 1 field names must not include unsafe control characters'
    );
  });

  it('rejects stale viral badge referral rows before badge reads or writes', async () => {
    const referralRepo = {
      find: jest.fn(async () => [
        {
          id: 'referral-stale-badge-evidence',
          referrer_id: 'user-a',
          referee_id: 'user-b',
          referee_order_id: 'order-1',
          status: 'order_placed',
          order_placed_at: new Date('2026-06-10T12:00:00.000Z'),
          reward_value_cents: 10000,
        },
      ]),
    };
    const badgeRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow(
      'Viral badge referral row 1 status must match reward_claimed query for referral referral-stale-badge-evidence'
    );

    expect(referralRepo.find).toHaveBeenCalledWith({
      where: { referrer_id: 'user-a', status: 'reward_claimed' },
    });
    expect(badgeRepo.findOne).not.toHaveBeenCalled();
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate viral badge referral evidence before counting badge progress', async () => {
    const referralRepo = createRepository<any>(
      Array.from({ length: 10 }, () => claimedReferralRow({
        id: 'referral-duplicate-badge-evidence',
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }))
    );
    const badgeRepo = createRepository<any>();
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow(
      'Customer referral stats row 2 id must be unique for user user-a'
    );

    expect(referralRepo.find).toHaveBeenCalledWith({
      where: { referrer_id: 'user-a', status: 'reward_claimed' },
    });
    expect(badgeRepo.findOne).not.toHaveBeenCalled();
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it('rejects malformed existing viral badge rows before skipping badge creation', async () => {
    const referralRepo = createRepository<any>(
      Array.from({ length: 10 }, (_, index) => claimedReferralRow({
        id: `referral-${index + 1}`,
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }))
    );
    const badgeRepo = {
      findOne: jest.fn(async () => [] as any),
      create: jest.fn((record) => record),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow('Existing viral badge must be an object');

    expect(badgeRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-a', badge_type: 'superstar' },
    });
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'unsupported field',
      badgeOverrides: { provider_trace_id: 'trace-123' },
      expectedError:
        'Existing viral badge badge-provider-award include unsupported field(s): provider_trace_id',
    },
    {
      caseName: 'invalid created_at evidence',
      badgeOverrides: { created_at: '2026-06-10T00:00:00.000Z' },
      expectedError: 'Existing viral badge badge-provider-award created_at must be a valid Date',
    },
    {
      caseName: 'invalid awarded_at evidence',
      badgeOverrides: { awarded_at: '2026-06-10T00:00:00.000Z' },
      expectedError: 'Existing viral badge badge-provider-award awarded_at must be a valid Date',
    },
    {
      caseName: 'pre-creation awarded_at evidence',
      badgeOverrides: {
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        awarded_at: new Date('2026-06-09T23:59:59.000Z'),
      },
      expectedError: 'Existing viral badge badge-provider-award awarded_at cannot be before created_at',
    },
    {
      caseName: 'stale updated_at evidence',
      badgeOverrides: {
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        updated_at: new Date('2026-06-09T23:59:59.000Z'),
      },
      expectedError: 'Existing viral badge badge-provider-award updated_at cannot be before created_at',
    },
  ])('rejects $caseName on existing viral badge award rows before skipping badge creation', async ({
    badgeOverrides,
    expectedError,
  }) => {
    const referralRepo = createRepository<any>(
      Array.from({ length: 10 }, (_, index) => claimedReferralRow({
        id: `referral-${index + 1}`,
        referrer_id: 'user-a',
        reward_value_cents: 10000,
      }))
    );
    const badgeRepo = {
      findOne: jest.fn(async () => ({
        id: 'badge-provider-award',
        user_id: 'user-a',
        badge_type: 'superstar',
        tier: 1,
        referrals_required: 10,
        referrals_achieved: 10,
        ...badgeOverrides,
      })),
      create: jest.fn((record) => record),
      save: jest.fn(async (record) => record),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === CustomerReferral || entity?.name === 'CustomerReferral') return referralRepo;
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).checkAndAwardBadges('user-a')
    ).rejects.toThrow(expectedError);

    expect(badgeRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-a', badge_type: 'superstar' },
    });
    expect(badgeRepo.create).not.toHaveBeenCalled();
    expect(badgeRepo.save).not.toHaveBeenCalled();
  });

  it('rejects cross-user viral badge rows before returning user badges', async () => {
    const badgeRepo = {
      find: jest.fn(async () => [
        {
          id: 'badge-cross-user',
          user_id: 'user-b',
          badge_type: 'superstar',
          tier: 1,
          referrals_required: 10,
          referrals_achieved: 10,
        },
      ]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getUserBadges('user-a')
    ).rejects.toThrow('Viral badge row 1 user_id must match requested user for badge badge-cross-user');

    expect(badgeRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-a' },
      order: { tier: 'DESC' },
    });
  });

  it('rejects malformed viral badge row envelopes before returning user badges', async () => {
    const badgeRepo = {
      find: jest.fn(async () => [[] as any]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getUserBadges('user-a')
    ).rejects.toThrow('Viral badge row 1 must be an object');

    expect(badgeRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-a' },
      order: { tier: 'DESC' },
    });
  });

  it('rejects duplicate viral badge ids before returning user badges', async () => {
    const badgeRepo = {
      find: jest.fn(async () => [
        {
          id: 'badge-duplicate',
          user_id: 'user-a',
          badge_type: 'viral_king',
          tier: 3,
          referrals_required: 100,
          referrals_achieved: 100,
        },
        {
          id: 'badge-duplicate',
          user_id: 'user-a',
          badge_type: 'superstar',
          tier: 1,
          referrals_required: 10,
          referrals_achieved: 10,
        },
      ]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getUserBadges('user-a')
    ).rejects.toThrow('Viral badge row 2 id must be unique for user user-a');

    expect(badgeRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-a' },
      order: { tier: 'DESC' },
    });
  });

  it.each([
    {
      caseName: 'unsupported provider fields',
      badgeOverrides: { provider_trace_id: 'trace-123' },
      expectedError: 'Viral badge row 1 include unsupported field(s): provider_trace_id',
    },
    {
      caseName: 'unsafe provider field names',
      badgeOverrides: { ['provider_trace_id\uFEFF']: 'trace-123' },
      expectedError: 'Viral badge row 1 field names must not include unsafe control characters',
    },
    {
      caseName: 'invalid awarded_at evidence',
      badgeOverrides: { awarded_at: '2026-06-10T00:00:00.000Z' },
      expectedError: 'Viral badge row 1 awarded_at must be a valid Date',
    },
    {
      caseName: 'pre-creation awarded_at evidence',
      badgeOverrides: {
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        awarded_at: new Date('2026-06-09T23:59:59.000Z'),
      },
      expectedError: 'Viral badge row 1 awarded_at cannot be before created_at',
    },
  ])('rejects $caseName before returning user badges', async ({ badgeOverrides, expectedError }) => {
    const badgeRepo = {
      find: jest.fn(async () => [
        {
          id: 'badge-provider-field',
          user_id: 'user-a',
          badge_type: 'superstar',
          tier: 1,
          referrals_required: 10,
          referrals_achieved: 10,
          ...badgeOverrides,
        },
      ]),
    };
    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === ViralBadge || entity?.name === 'ViralBadge') return badgeRepo;
      return createRepository();
    }) as any;

    await expect(
      new ViralService({ enforceCapability: false }).getUserBadges('user-a')
    ).rejects.toThrow(expectedError);

    expect(badgeRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-a' },
      order: { tier: 'DESC' },
    });
  });
});

describe('EnhancedReferralService leaderboard and share determinism', () => {
  it('uses UTC month boundaries for referral leaderboard windows', () => {
    const now = new Date('2026-06-30T23:59:59.999Z');

    expect(referralLeaderboardMonth(now)).toBe('2026-06');
    expect(startOfReferralLeaderboardMonth(now)).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });

  it('rejects invalid leaderboard clocks before month, repository reads, or prize writes', async () => {
    const invalidClock = new Date('not-a-real-date');

    expect(() => referralLeaderboardMonth(invalidClock)).toThrow(
      'Referral leaderboard clock must be a valid Date'
    );
    expect(() => startOfReferralLeaderboardMonth(invalidClock)).toThrow(
      'Referral leaderboard clock must be a valid Date'
    );

    const leaderboardRepository = createRepository<any>();
    const referralRepository = createRepository<any>();
    referralRepository.count = jest.fn(async () => 1);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: referralRepository as any,
      userRepository: createRepository() as any,
      now: () => invalidClock,
      enforceCapability: false,
    });

    await expect(service.updateLeaderboard('user-1')).rejects.toThrow(
      'Referral leaderboard clock must be a valid Date'
    );
    await expect(service.getTopReferrers()).rejects.toThrow(
      'Referral leaderboard clock must be a valid Date'
    );
    await expect(service.distributePrizes('2026-06')).rejects.toThrow(
      'Referral leaderboard clock must be a valid Date'
    );

    expect(referralRepository.count).not.toHaveBeenCalled();
    expect(leaderboardRepository.find).not.toHaveBeenCalled();
    expect(leaderboardRepository.findOne).not.toHaveBeenCalled();
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
  });

  it('sorts leaderboard ties by user id before assigning stable ranks', () => {
    const ranked = rankReferralLeaderboardEntries([
      { user_id: 'user-c', successful_referrals: 2 },
      { user_id: 'user-b', successful_referrals: 5 },
      { user_id: 'user-a', successful_referrals: 5 },
    ] as any[]);

    expect(ranked.map((entry) => [entry.user_id, entry.rank])).toEqual([
      ['user-a', 1],
      ['user-b', 2],
      ['user-c', 3],
    ]);
  });

  it('rejects blank leaderboard identifiers before repository reads or writes', async () => {
    const leaderboardRepository = createRepository<any>();
    const referralRepository = createRepository<any>();
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: referralRepository as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.updateLeaderboard('   ')).rejects.toThrow(
      'Referral leaderboard user_id must be a non-empty string'
    );
    await expect(service.getUserPosition('   ')).rejects.toThrow(
      'Referral leaderboard user_id must be a non-empty string'
    );
    await expect(service.distributePrizes('   ')).rejects.toThrow(
      'Referral leaderboard prize month must be a non-empty string'
    );
    await expect(service.distributePrizes('2026-13')).rejects.toThrow(
      'Referral leaderboard prize month must use YYYY-MM format'
    );

    expect(referralRepository.count).not.toHaveBeenCalled();
    expect(leaderboardRepository.find).not.toHaveBeenCalled();
    expect(leaderboardRepository.findOne).not.toHaveBeenCalled();
    expect(leaderboardRepository.create).not.toHaveBeenCalled();
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt leaderboard referral counts before ranking or prize decisions', async () => {
    expect(() =>
      rankReferralLeaderboardEntries([[]] as any[])
    ).toThrow('Referral leaderboard entry row 1 must be an object');

    expect(() =>
      rankReferralLeaderboardEntries([
        { user_id: '   ', successful_referrals: 5 },
      ] as any[])
    ).toThrow('Referral leaderboard entry user_id must be a non-empty string');

    expect(() =>
      rankReferralLeaderboardEntries([
        { user_id: 'user-a', successful_referrals: 5 },
        { user_id: 'user-corrupt', successful_referrals: -1 },
      ] as any[])
    ).toThrow('Successful referrals for leaderboard entry user-corrupt must be a non-negative integer');

    expect(() =>
      rankReferralLeaderboardEntries([
        { user_id: 'user-unsafe', successful_referrals: Number.MAX_SAFE_INTEGER + 1 },
      ] as any[])
    ).toThrow('Successful referrals for leaderboard entry user-unsafe must be a safe integer');

    const corruptEntry = {
      id: 'entry-corrupt',
      user_id: 'user-corrupt',
      month: '2026-06',
      successful_referrals: 1.5,
      prize_paid: false,
    };
    const leaderboardRepository = createRepository<any>([corruptEntry]);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-30T00:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.distributePrizes('2026-06')).rejects.toThrow(
      'Successful referrals for leaderboard entry user-corrupt must be a non-negative integer'
    );
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
    expect(corruptEntry.prize_paid).toBe(false);
  });

  it('updates leaderboard entries using deterministic month and UTC first-day filter', async () => {
    const leaderboardRepository = createRepository<any>();
    const referralRepository = createRepository<any>();
    referralRepository.count = jest.fn(async () => 7);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: referralRepository as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await service.updateLeaderboard(' user-1 ');

    expect(referralRepository.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        referrer_id: 'user-1',
        status: 'first_menu_published',
        first_menu_published_at: expect.objectContaining({
          _type: 'moreThan',
          _value: new Date('2026-06-01T00:00:00.000Z'),
        }),
      }),
    });
    expect(leaderboardRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      month: '2026-06',
      successful_referrals: 7,
    }));
  });

  it('rejects corrupt existing leaderboard update rows before overwriting counts', async () => {
    const cases = [
      {
        row: {
          id: 'entry-provider-row',
          user_id: 'user-1',
          month: '2026-06',
          successful_referrals: 3,
          provider_trace_id: 'trace-123',
        },
        expectedError: 'Referral leaderboard update row entry-provider-row include unsupported field(s): provider_trace_id',
      },
      {
        row: {
          id: 'entry-provider-field-name',
          user_id: 'user-1',
          month: '2026-06',
          successful_referrals: 3,
          ['provider_trace_id\uFEFF']: 'trace-123',
        },
        expectedError:
          'Referral leaderboard update row entry-provider-field-name field names must not include unsafe control characters',
      },
      {
        row: {
          id: 'entry-cross-user',
          user_id: 'user-elsewhere',
          month: '2026-06',
          successful_referrals: 3,
        },
        expectedError: 'Referral leaderboard update row entry-cross-user user_id must match requested user',
      },
      {
        row: {
          id: 'entry-cross-month',
          user_id: 'user-1',
          month: '2026-05',
          successful_referrals: 3,
        },
        expectedError: 'Referral leaderboard update row entry-cross-month month must match requested leaderboard month',
      },
      {
        row: {
          id: 'entry-corrupt-count',
          user_id: 'user-1',
          month: '2026-06',
          successful_referrals: -1,
        },
        expectedError: 'Successful referrals for leaderboard update row entry-corrupt-count must be a non-negative integer',
      },
    ];

    for (const { row, expectedError } of cases) {
      const leaderboardRepository = {
        ...createRepository<any>(),
        findOne: jest.fn(async () => ({ ...row })),
      };
      const referralRepository = createRepository<any>();
      referralRepository.count = jest.fn(async () => 7);
      const service = new LeaderboardService({
        leaderboardRepository: leaderboardRepository as any,
        referralRepository: referralRepository as any,
        userRepository: createRepository() as any,
        now: () => new Date('2026-06-21T12:00:00.000Z'),
        enforceCapability: false,
      });

      await expect(service.updateLeaderboard('user-1')).rejects.toThrow(expectedError);

      expect(leaderboardRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid leaderboard counts and limits before writing or repository reads', async () => {
    const leaderboardRepository = createRepository<any>();
    const referralRepository = createRepository<any>();
    referralRepository.count = jest.fn(async () => Number.MAX_SAFE_INTEGER + 1);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: referralRepository as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.updateLeaderboard('user-1')).rejects.toThrow(
      'Successful referrals for user user-1 must be a safe integer'
    );
    expect(leaderboardRepository.findOne).not.toHaveBeenCalled();
    expect(leaderboardRepository.save).not.toHaveBeenCalled();

    await expect(service.getTopReferrers(0)).rejects.toThrow(
      'Leaderboard limit must be a positive integer'
    );
    await expect(service.getTopReferrers(1.5)).rejects.toThrow(
      'Leaderboard limit must be a positive integer'
    );
    expect(leaderboardRepository.find).not.toHaveBeenCalled();
  });

  it('returns stable top referrers and user positions even if repository ordering drifts', async () => {
    const leaderboardRepository = createRepository<any>([
      { id: 'entry-c', user_id: 'user-c', month: '2026-06', successful_referrals: 2 },
      { id: 'entry-b', user_id: 'user-b', month: '2026-06', successful_referrals: 5 },
      { id: 'entry-a', user_id: 'user-a', month: '2026-06', successful_referrals: 5 },
    ]);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.getTopReferrers(2)).resolves.toEqual([
      expect.objectContaining({ user_id: 'user-a', rank: 1 }),
      expect.objectContaining({ user_id: 'user-b', rank: 2 }),
    ]);
    await expect(service.getUserPosition(' user-b ')).resolves.toEqual({
      rank: 2,
      successful_referrals: 5,
      total_participants: 3,
    });
  });

  it('rejects stale cross-month leaderboard rows before returning rankings', async () => {
    const leaderboardRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [[] as any]),
    };
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.getTopReferrers(10)).rejects.toThrow('Referral leaderboard row 1 must be an object');
    await expect(service.getUserPosition('user-a')).rejects.toThrow('Referral leaderboard row 1 must be an object');

    leaderboardRepository.find = jest.fn(async () => [
      {
        id: 'entry-provider-row',
        user_id: 'user-provider',
        month: '2026-06',
        successful_referrals: 7,
        provider_trace_id: 'trace-123',
      },
      { id: 'entry-current', user_id: 'user-a', month: '2026-06', successful_referrals: 5 },
      { id: 'entry-stale', user_id: 'user-b', month: '2026-05', successful_referrals: 6 },
    ]);

    await expect(service.getTopReferrers(10)).rejects.toThrow(
      'Referral leaderboard row 1 include unsupported field(s): provider_trace_id'
    );
    await expect(service.getUserPosition('user-a')).rejects.toThrow(
      'Referral leaderboard row 1 include unsupported field(s): provider_trace_id'
    );

    leaderboardRepository.find = jest.fn(async () => [
      { id: 'entry-current', user_id: 'user-a', month: '2026-06', successful_referrals: 5 },
      { id: 'entry-stale', user_id: 'user-b', month: '2026-05', successful_referrals: 6 },
    ]);
    await expect(service.getTopReferrers(10)).rejects.toThrow(
      'Referral leaderboard row 2 month must match requested leaderboard month for entry entry-stale'
    );
    await expect(service.getUserPosition('user-a')).rejects.toThrow(
      'Referral leaderboard row 2 month must match requested leaderboard month for entry entry-stale'
    );
  });

  it('rejects mismatched leaderboard user relations before returning rankings', async () => {
    const leaderboardRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        {
          id: 'entry-cross-user-relation',
          user_id: 'user-a',
          user: { id: 'user-elsewhere' },
          month: '2026-06',
          successful_referrals: 5,
        },
      ]),
    };
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.getTopReferrers(10)).rejects.toThrow(
      'Referral leaderboard row 1 user relation id must match leaderboard user_id for entry entry-cross-user-relation'
    );
    await expect(service.getUserPosition('user-a')).rejects.toThrow(
      'Referral leaderboard row 1 user relation id must match leaderboard user_id for entry entry-cross-user-relation'
    );
  });

  it('rejects duplicate leaderboard row identities before rankings or prize writes', async () => {
    const duplicateIdRows = [
      { id: 'entry-duplicate', user_id: 'user-a', month: '2026-06', successful_referrals: 7 },
      { id: 'entry-duplicate', user_id: 'user-b', month: '2026-06', successful_referrals: 6 },
    ];
    const duplicateUserRows = [
      { id: 'entry-a', user_id: 'user-a', month: '2026-06', successful_referrals: 7 },
      { id: 'entry-b', user_id: 'user-a', month: '2026-06', successful_referrals: 6 },
    ];
    const leaderboardRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => duplicateIdRows),
    };
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-21T12:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.getTopReferrers(10)).rejects.toThrow(
      'Referral leaderboard row 2 id must be unique for leaderboard month'
    );
    await expect(service.getUserPosition('user-a')).rejects.toThrow(
      'Referral leaderboard row 2 id must be unique for leaderboard month'
    );

    leaderboardRepository.find = jest.fn(async () => duplicateUserRows);
    await expect(service.getTopReferrers(10)).rejects.toThrow(
      'Referral leaderboard row 2 user_id must be unique for leaderboard month'
    );
    await expect(service.getUserPosition('user-a')).rejects.toThrow(
      'Referral leaderboard row 2 user_id must be unique for leaderboard month'
    );

    const duplicatePrizeRows = [
      {
        id: 'entry-prize',
        user_id: 'user-a',
        month: '2026-06',
        successful_referrals: 10,
        prize_paid: false,
        prize_amount_cents: 0,
      },
      {
        id: 'entry-prize',
        user_id: 'user-b',
        month: '2026-06',
        successful_referrals: 9,
        prize_paid: false,
        prize_amount_cents: 0,
      },
    ];
    leaderboardRepository.find = jest.fn(async () => duplicatePrizeRows);

    await expect(service.distributePrizes('2026-06')).rejects.toThrow(
      'Referral leaderboard prize row 2 id must be unique for leaderboard month'
    );
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
    expect(duplicatePrizeRows[0].prize_paid).toBe(false);
    expect(duplicatePrizeRows[1].prize_paid).toBe(false);
  });

  it('rejects stale cross-month leaderboard prize rows before prize writes', async () => {
    const providerPrizeRow = {
      id: 'entry-provider-prize',
      user_id: 'user-provider',
      month: '2026-06',
      successful_referrals: 11,
      prize_paid: false,
      prize_amount_cents: 0,
      provider_trace_id: 'trace-123',
    };
    const stalePrizeRow = {
      id: 'entry-stale-prize',
      user_id: 'user-a',
      month: '2026-05',
      successful_referrals: 10,
      prize_paid: false,
      prize_amount_cents: 0,
    };
    const leaderboardRepository = {
      ...createRepository<any>([providerPrizeRow, stalePrizeRow]),
      find: jest.fn(async () => [providerPrizeRow, stalePrizeRow]),
    };
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-30T00:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.distributePrizes('2026-06')).rejects.toThrow(
      'Referral leaderboard prize row 1 include unsupported field(s): provider_trace_id'
    );
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
    expect(providerPrizeRow.prize_paid).toBe(false);

    leaderboardRepository.find = jest.fn(async () => [stalePrizeRow]);
    await expect(service.distributePrizes('2026-06')).rejects.toThrow(
      'Referral leaderboard prize row 1 month must match requested leaderboard month for entry entry-stale-prize'
    );
    expect(leaderboardRepository.save).not.toHaveBeenCalled();
    expect(stalePrizeRow.prize_paid).toBe(false);
  });

  it('rejects corrupt leaderboard prize evidence before skipping or writing winners', async () => {
    const scenarios = [
      {
        row: {
          id: 'entry-paid-missing-date',
          user_id: 'user-a',
          month: '2026-06',
          successful_referrals: 10,
          prize_paid: true,
          prize_amount_cents: 500000,
        },
        expectedError: 'Referral leaderboard prize row entry-paid-missing-date prize_paid_at must be a valid Date',
      },
      {
        row: {
          id: 'entry-paid-stale-amount',
          user_id: 'user-a',
          month: '2026-06',
          successful_referrals: 10,
          prize_paid: true,
          prize_amount_cents: 300000,
          prize_paid_at: new Date('2026-06-29T00:00:00.000Z'),
        },
        expectedError: 'Referral leaderboard prize row entry-paid-stale-amount prize_amount_cents must match current prize amount',
      },
      {
        row: {
          id: 'entry-unpaid-stale-amount',
          user_id: 'user-a',
          month: '2026-06',
          successful_referrals: 10,
          prize_paid: false,
          prize_amount_cents: 500000,
        },
        expectedError: 'Referral leaderboard prize row entry-unpaid-stale-amount prize_amount_cents cannot be present before prize payment',
      },
      {
        row: {
          id: 'entry-unpaid-stale-date',
          user_id: 'user-a',
          month: '2026-06',
          successful_referrals: 10,
          prize_paid: false,
          prize_amount_cents: 0,
          prize_paid_at: new Date('2026-06-29T00:00:00.000Z'),
        },
        expectedError: 'Referral leaderboard prize row entry-unpaid-stale-date prize_paid_at cannot be present before prize payment',
      },
    ];

    for (const { row, expectedError } of scenarios) {
      const leaderboardRepository = createRepository<any>([row]);
      const service = new LeaderboardService({
        leaderboardRepository: leaderboardRepository as any,
        referralRepository: createRepository() as any,
        userRepository: createRepository() as any,
        now: () => new Date('2026-06-30T00:00:00.000Z'),
        enforceCapability: false,
      });

      await expect(service.distributePrizes('2026-06')).rejects.toThrow(expectedError);
      expect(leaderboardRepository.save).not.toHaveBeenCalled();
    }
  });

  it('distributes leaderboard prizes only for unpaid winners and returns processed count', async () => {
    const alreadyPaid = {
      id: 'entry-paid',
      user_id: 'user-a',
      month: '2026-06',
      successful_referrals: 10,
      prize_paid: true,
      prize_amount_cents: 500000,
      prize_paid_at: new Date('2026-06-29T00:00:00.000Z'),
    };
    const unpaid = {
      id: 'entry-unpaid',
      user_id: 'user-b',
      month: '2026-06',
      successful_referrals: 9,
      prize_paid: false,
      prize_amount_cents: 0,
    };
    const leaderboardRepository = createRepository<any>([
      unpaid,
      alreadyPaid,
    ]);
    const service = new LeaderboardService({
      leaderboardRepository: leaderboardRepository as any,
      referralRepository: createRepository() as any,
      userRepository: createRepository() as any,
      now: () => new Date('2026-06-30T00:00:00.000Z'),
      enforceCapability: false,
    });

    await expect(service.distributePrizes(' 2026-06 ')).resolves.toBe(1);
    expect(leaderboardRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { month: '2026-06' },
    }));

    expect(unpaid).toMatchObject({
      rank: 2,
      prize_amount_cents: 300000,
      prize_paid: true,
      prize_paid_at: new Date('2026-06-30T00:00:00.000Z'),
    });
    expect(leaderboardRepository.save).toHaveBeenCalledTimes(1);
  });

  it('builds encoded referral links and share copy without unsupported reward promises', () => {
    AppDataSource.getRepository = jest.fn(() => createRepository() as any) as any;
    const service = new ViralService({ enforceCapability: false });

    expect(buildReferralShareLink(' cust 123 ')).toBe('https://menumaker.app?ref=CUST+123');

    const instagram = service.generateInstagramStoryShare('CUST123', 'Cafe Blue', 'https://cdn.example/menu.png');
    expect(instagram.story_template).toMatchObject({
      background_image: 'https://cdn.example/menu.png',
      link: 'https://menumaker.app?ref=CUST123',
    });
    expect(instagram.story_template.text).toContain('Cafe Blue');
    expect(instagram.story_template.text).not.toMatch(/Rs\.|₹|off/i);
    expect(() => service.generateInstagramStoryShare(
      'CUST123',
      'Cafe Blue',
      'https://cdn:secret@cdn.example/menu.png'
    )).toThrow('Referral share menu preview URL must not include embedded credentials');
    expect(() => buildReferralShareLink('A'.repeat(129))).toThrow(
      'Referral code must be 128 characters or less'
    );
    expect(() => service.generateWhatsAppShare('A'.repeat(129), 'Cafe Blue')).toThrow(
      'Referral code must be 128 characters or less'
    );
    expect(() => service.generateInstagramStoryShare('CUST123', 'A'.repeat(161))).toThrow(
      'Referral share business name must be 160 characters or less'
    );
    expect(() => service.generateWhatsAppShare('CUST123', 'A'.repeat(161))).toThrow(
      'Referral share business name must be 160 characters or less'
    );

    const whatsapp = service.generateWhatsAppShare('CUST123', 'Cafe Blue');
    expect(whatsapp.message).toContain('Launch rewards are shown in the app when available.');
    expect(whatsapp.message).not.toMatch(/Rs\.|₹|off/i);
    expect(decodeURIComponent(whatsapp.share_url)).toContain('Use code: CUST123');
  });
});

describe('EnhancedReferralService affiliate accounting', () => {
  it('calculates affiliate commissions with explicit cent and rate validation', () => {
    expect(calculateAffiliateCommissionCents(12345, 2.5)).toBe(309);
    expect(() => calculateAffiliateCommissionCents(-1, 2)).toThrow('GMV must be a non-negative integer');
    expect(() =>
      calculateAffiliateCommissionCents(Number.MAX_SAFE_INTEGER + 1, 2)
    ).toThrow('GMV must be a safe integer amount in cents');
    expect(() => calculateAffiliateCommissionCents(1000, 101)).toThrow('Commission rate must be between 0 and 100');
    expect(() =>
      calculateAffiliateCommissionCents(Number.MAX_SAFE_INTEGER, 100)
    ).toThrow('Affiliate commission scaled amount must be a safe finite amount before rounding');
  });

  it('rejects malformed affiliate application metadata before repository reads', async () => {
    const affiliateRepository = createRepository<any>();
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    await expect(
      service.applyForAffiliate('   ', {
        application_message: 'I run a food blog.',
      })
    ).rejects.toThrow('Affiliate application user_id must be a non-empty string');
    await expect(
      service.applyForAffiliate('user\u0000-1', {
        application_message: 'I run a food blog.',
      })
    ).rejects.toThrow('Affiliate application user_id must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user\u202E-1', {
        application_message: 'I run a food blog.',
      })
    ).rejects.toThrow('Affiliate application user_id must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('\uFEFFuser-1', {
        application_message: 'I run a food blog.',
      })
    ).rejects.toThrow('Affiliate application user_id must not include unsafe control characters');

    await expect(
      service.applyForAffiliate('user-1', null as any)
    ).rejects.toThrow('Affiliate application data must be an object');

    await expect(
      service.applyForAffiliate('user-1', [] as any)
    ).rejects.toThrow('Affiliate application data must be an object');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        payout_method: 'paypal',
      } as any)
    ).rejects.toThrow('Affiliate application data includes unsupported field(s): payout_method');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        'payout_method\uFEFF': 'paypal',
      } as any)
    ).rejects.toThrow('Affiliate application data field names must not include unsafe control characters');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: '   ',
      })
    ).rejects.toThrow('Affiliate application message must be a non-empty string');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.\u0007',
      })
    ).rejects.toThrow('Affiliate application message must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.\u200B',
      })
    ).rejects.toThrow('Affiliate application message must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.\uFEFF',
      })
    ).rejects.toThrow('Affiliate application message must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'x'.repeat(1001),
      })
    ).rejects.toThrow('Affiliate application message must be at most 1000 characters');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_handle: { handle: '@blogger' } as any,
      })
    ).rejects.toThrow('Affiliate Instagram handle must be a string');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_handle: '@blogger\u007F',
      })
    ).rejects.toThrow('Affiliate Instagram handle must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_handle: '@blogger\u202E',
      })
    ).rejects.toThrow('Affiliate Instagram handle must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_handle: '\uFEFF@blogger',
      })
    ).rejects.toThrow('Affiliate Instagram handle must not include unsafe control characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_handle: `@${'b'.repeat(255)}`,
      })
    ).rejects.toThrow('Affiliate Instagram handle must be at most 255 characters');
    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        youtube_channel: 'y'.repeat(256),
      })
    ).rejects.toThrow('Affiliate YouTube channel must be at most 255 characters');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        instagram_followers: -1,
      })
    ).rejects.toThrow('Affiliate Instagram followers must be a non-negative integer');

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
        youtube_subscribers: Number.MAX_SAFE_INTEGER + 1,
      })
    ).rejects.toThrow('Affiliate YouTube subscribers must be a safe integer');

    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.create).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(userRepository.findOne).not.toHaveBeenCalled();
  });

  it('normalizes affiliate application metadata before creating pending applications', async () => {
    const affiliateRepository = createRepository<any>();
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    const application = await service.applyForAffiliate(' user-1 ', {
      application_message: '  I run an independent restaurant newsletter.  ',
      instagram_handle: '  @menu_blogger  ',
      instagram_followers: '1200' as any,
      youtube_channel: '   ',
      youtube_subscribers: 0,
    });

    expect(application).toMatchObject({
      user_id: 'user-1',
      status: 'pending',
      application_message: 'I run an independent restaurant newsletter.',
      instagram_handle: '@menu_blogger',
      instagram_followers: 1200,
      youtube_subscribers: 0,
    });
    expect(application).not.toHaveProperty('youtube_channel');
    expect(affiliateRepository.save).toHaveBeenCalledWith(application);
  });

  it('rejects mismatched affiliate application user lookup rows before creating public codes', async () => {
    const affiliateRepository = createRepository<any>();
    const userRepository = {
      findOne: jest.fn(async () => ({
        id: 'user-elsewhere',
        email: 'elsewhere@example.com',
        full_name: 'Else Where',
      })),
    };
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    await expect(
      service.applyForAffiliate('user-1', {
        application_message: 'I run an independent restaurant newsletter.',
      })
    ).rejects.toThrow('Affiliate application user row id must match requested user');

    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(affiliateRepository.create).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('omits absent optional affiliate application fields before persistence', async () => {
    const affiliateRepository = createRepository<any>();
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    const application = await service.applyForAffiliate('user-1', {
      application_message: 'I run an independent restaurant newsletter.',
      instagram_handle: '   ',
      youtube_channel: '   ',
    });

    expect(application).toMatchObject({
      user_id: 'user-1',
      status: 'pending',
      application_message: 'I run an independent restaurant newsletter.',
    });
    expect(application).not.toHaveProperty('instagram_handle');
    expect(application).not.toHaveProperty('instagram_followers');
    expect(application).not.toHaveProperty('youtube_channel');
    expect(application).not.toHaveProperty('youtube_subscribers');
    expect(affiliateRepository.create).toHaveBeenCalledWith(expect.not.objectContaining({
      instagram_handle: expect.anything(),
      instagram_followers: expect.anything(),
      youtube_channel: expect.anything(),
      youtube_subscribers: expect.anything(),
    }));
  });

  it('rejects generated affiliate code collisions before creating pending applications', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_781_234_567_890);
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-existing-code',
        user_id: 'user-existing',
        affiliate_code: 'SELLERONE_567890',
        status: 'approved',
      },
    ]);
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    try {
      await expect(service.applyForAffiliate('user-1', {
        application_message: 'I run an independent restaurant newsletter.',
      })).rejects.toThrow('Generated affiliate code already exists');
    } finally {
      nowSpy.mockRestore();
    }

    expect(affiliateRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { user_id: 'user-1' },
    });
    expect(affiliateRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { affiliate_code: 'SELLERONE_567890' },
    });
    expect(affiliateRepository.create).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt affiliate code collision rows before creating pending applications', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_781_234_567_890);
    const collisionRow = {
      id: 'affiliate-corrupt-code-owner',
      user_id: 'user-existing',
      affiliate_code: 'SELLERONE_567890',
      status: 'teleported',
    };
    const affiliateRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async (options: { where: Record<string, any> }) => {
        if (options.where.user_id === 'user-1') return null;
        if (options.where.affiliate_code === 'SELLERONE_567890') return collisionRow;
        return null;
      }),
    };
    const userRepository = createRepository<any>([
      { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: userRepository as any,
      enforceCapability: false,
    });

    try {
      await expect(service.applyForAffiliate('user-1', {
        application_message: 'I run an independent restaurant newsletter.',
      })).rejects.toThrow(
        'Existing affiliate code owner affiliate-corrupt-code-owner status must be pending, approved, rejected, or suspended'
      );
    } finally {
      nowSpy.mockRestore();
    }

    expect(affiliateRepository.create).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt existing affiliate application rows before the duplicate shortcut', async () => {
    const cases = [
      {
        row: {
          id: 'affiliate-provider-row',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'pending',
          provider_trace_id: 'trace-123',
        },
        message: 'Existing affiliate application affiliate-provider-row include unsupported field(s): provider_trace_id',
      },
      {
        row: {
          id: 'affiliate-cross-user',
          user_id: 'user-elsewhere',
          affiliate_code: 'BLOGGER',
          status: 'pending',
        },
        message: 'Existing affiliate application affiliate-cross-user user_id must match requested user',
      },
      {
        row: {
          id: 'affiliate-bad-status',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'mystery',
        },
        message: 'Existing affiliate application affiliate-bad-status status must be pending, approved, rejected, or suspended',
      },
      {
        row: {
          id: 'affiliate-missing-code',
          user_id: 'user-1',
          affiliate_code: '   ',
          status: 'pending',
        },
        message: 'Existing affiliate application affiliate-missing-code affiliate_code must be a non-empty string',
      },
      {
        row: {
          id: 'affiliate-unsafe-code',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER/../ADMIN',
          status: 'pending',
        },
        message: 'Existing affiliate application affiliate-unsafe-code affiliate_code must contain only uppercase letters, numbers, and underscores',
      },
      {
        row: {
          id: 'affiliate-oversized-message',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'pending',
          application_message: 'x'.repeat(1001),
        },
        message: 'Existing affiliate application affiliate-oversized-message application_message must be at most 1000 characters',
      },
      {
        row: {
          id: 'affiliate-oversized-instagram',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'pending',
          instagram_handle: `@${'b'.repeat(255)}`,
        },
        message: 'Existing affiliate application affiliate-oversized-instagram instagram_handle must be at most 255 characters',
      },
    ];

    for (const { row, message } of cases) {
      const affiliateRepository = {
        ...createRepository<any>(),
        findOne: jest.fn(async () => row),
      };
      const userRepository = createRepository<any>([
        { id: 'user-1', email: 'seller@example.com', full_name: 'Seller One' },
      ]);
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        userRepository: userRepository as any,
        enforceCapability: false,
      });

      await expect(service.applyForAffiliate('user-1', {
        application_message: 'I run a food blog.',
      })).rejects.toThrow(message);

      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(affiliateRepository.create).not.toHaveBeenCalled();
      expect(affiliateRepository.save).not.toHaveBeenCalled();
    }
  });

  it('requires approved affiliates before tracking clicks or commissions', async () => {
    const affiliate = {
      id: 'affiliate-1',
      affiliate_code: 'BLOGGER',
      status: 'pending',
      total_clicks: 0,
      total_conversions: 0,
      total_signups: 0,
      total_gmv_cents: 0,
      total_commission_earned_cents: 0,
      total_commission_paid_cents: 0,
      pending_commission_cents: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackClick('BLOGGER', {})).rejects.toThrow('Affiliate is not approved');
    await expect(service.calculateCommission('affiliate-1', 10000, 'seller')).resolves.toBe(0);
  });

  it('rejects corrupt affiliate click statuses before creating clicks or updating counters', async () => {
    const affiliate = {
      id: 'affiliate-corrupt-click-status',
      affiliate_code: 'BLOGGER',
      status: 'mystery',
      total_clicks: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackClick('BLOGGER', {})).rejects.toThrow(
      'Affiliate affiliate-corrupt-click-status status must be pending, approved, rejected, or suspended'
    );

    expect(clickRepository.create).not.toHaveBeenCalled();
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_clicks).toBe(0);
  });

  it('rejects corrupt affiliate click source rows before creating clicks or updating counters', async () => {
    const cases = [
      {
        row: {
          id: 'affiliate-provider-row',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 0,
          provider_trace_id: 'trace-123',
        },
        message: 'Affiliate click source affiliate-provider-row include unsupported field(s): provider_trace_id',
      },
      {
        row: {
          id: 'affiliate-cross-code',
          affiliate_code: 'OTHERBLOGGER',
          status: 'approved',
          total_clicks: 0,
        },
        message: 'Affiliate click source affiliate-cross-code affiliate_code must match requested affiliate code',
      },
      {
        row: {
          id: 'affiliate-missing-code',
          affiliate_code: '   ',
          status: 'approved',
          total_clicks: 0,
        },
        message: 'Affiliate click source affiliate-missing-code affiliate_code must be a non-empty string',
      },
      {
        row: {
          id: 'affiliate-unsafe-code',
          affiliate_code: 'BLOGGER/../ADMIN',
          status: 'approved',
          total_clicks: 0,
        },
        message: 'Affiliate click source affiliate-unsafe-code affiliate_code must contain only uppercase letters, numbers, and underscores',
      },
      {
        row: {
          id: 'affiliate-unsafe-clicks',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: Number.MAX_SAFE_INTEGER,
        },
        message: 'Total clicks for affiliate affiliate-unsafe-clicks must remain a safe integer after increment',
      },
    ];

    for (const { row, message } of cases) {
      const affiliateRepository = {
        ...createRepository<any>(),
        findOne: jest.fn(async () => row),
      };
      const clickRepository = createRepository<any>();
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: clickRepository as any,
        payoutRepository: createRepository() as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.trackClick('BLOGGER', {})).rejects.toThrow(message);

      expect(clickRepository.create).not.toHaveBeenCalled();
      expect(clickRepository.save).not.toHaveBeenCalled();
      expect(affiliateRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects malformed affiliate click metadata before repository side effects', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-1',
        affiliate_code: 'BLOGGER',
        status: 'approved',
        total_clicks: 0,
      },
    ]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackClick('BLOGGER', [] as any)).rejects.toThrow(
      'Affiliate click metadata must be an object'
    );
    await expect(service.trackClick('BLOGGER', {
      user_agent: ['not-a-single-header-value'] as any,
    })).rejects.toThrow('Affiliate click user agent must be a string');
    await expect(service.trackClick('BLOGGER', {
      user_agent: 'Mozilla/5.0\u0000',
    })).rejects.toThrow('Affiliate click user agent must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      user_agent: 'Mozilla/5.0\u202E',
    })).rejects.toThrow('Affiliate click user agent must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      user_agent: '\uFEFFMozilla/5.0',
    })).rejects.toThrow('Affiliate click user agent must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      ip_address: 'not an ip address',
    })).rejects.toThrow('Affiliate click IP address must be a valid IPv4 or IPv6 address');
    await expect(service.trackClick('BLOGGER', {
      ip_address: '203.0.113.10, 198.51.100.25',
    })).rejects.toThrow('Affiliate click IP address must be a valid IPv4 or IPv6 address');
    await expect(service.trackClick('BLOGGER', {
      referrer_url: 'javascript:alert(1)',
    })).rejects.toThrow('Affiliate click referrer URL must be an absolute HTTP(S) URL');
    await expect(service.trackClick('BLOGGER', {
      referrer_url: '\uFEFFhttps://publisher.example.com/blog/post',
    })).rejects.toThrow('Affiliate click referrer URL must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      referrer_url: 'https://publisher:secret@example.com/blog/post',
    })).rejects.toThrow('Affiliate click referrer URL must not include embedded credentials');
    await expect(service.trackClick('BLOGGER', {
      utm_campaign: 'x'.repeat(101),
    })).rejects.toThrow('Affiliate click UTM campaign must be at most 100 characters');
    await expect(service.trackClick('BLOGGER', {
      utm_campaign: 'launch\u0007campaign',
    })).rejects.toThrow('Affiliate click UTM campaign must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      utm_campaign: 'launch\u200Bcampaign',
    })).rejects.toThrow('Affiliate click UTM campaign must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      utm_campaign: 'launch-campaign\uFEFF',
    })).rejects.toThrow('Affiliate click UTM campaign must not include unsafe control characters');
    await expect(service.trackClick('BLOGGER', {
      utm_source: 'newsletter',
      provider_trace_id: 'trace-123',
    } as any)).rejects.toThrow(
      'Affiliate click metadata includes unsupported field(s): provider_trace_id'
    );
    await expect(service.trackClick('BLOGGER', {
      utm_source: 'newsletter',
      'provider_trace_id\uFEFF': 'trace-123',
    } as any)).rejects.toThrow(
      'Affiliate click metadata field names must not include unsafe control characters'
    );

    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(clickRepository.create).not.toHaveBeenCalled();
    expect(clickRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes affiliate click metadata before click persistence', async () => {
    const affiliate = {
      id: 'affiliate-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    const click = await service.trackClick(' BLOGGER ', {
      ip_address: ' 203.0.113.10 ',
      user_agent: ' MenuMakerBot/1.0 ',
      referrer_url: ' https://example.com/blog/post ',
      utm_source: ' newsletter ',
      utm_medium: ' email ',
      utm_campaign: ' launch-week ',
    });

    expect(click).toMatchObject({
      affiliate_id: 'affiliate-1',
      ip_address: '203.0.113.10',
      user_agent: 'MenuMakerBot/1.0',
      referrer_url: 'https://example.com/blog/post',
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch-week',
    });
    expect(affiliate.total_clicks).toBe(1);
    expect(clickRepository.save).toHaveBeenCalledWith(click);
    expect(affiliateRepository.save).toHaveBeenCalledWith(affiliate);
  });

  it('normalizes IPv6 affiliate click addresses before click persistence', async () => {
    const affiliate = {
      id: 'affiliate-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    const click = await service.trackClick('BLOGGER', {
      ip_address: ' 2001:db8::10 ',
    });

    expect(click).toMatchObject({
      affiliate_id: 'affiliate-1',
      ip_address: '2001:db8::10',
    });
    expect(affiliate.total_clicks).toBe(1);
    expect(clickRepository.save).toHaveBeenCalledWith(click);
    expect(affiliateRepository.save).toHaveBeenCalledWith(affiliate);
  });

  it('tracks affiliate clicks with omitted metadata without fabricating optional fields', async () => {
    const affiliate = {
      id: 'affiliate-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    const click = await service.trackClick('BLOGGER');

    expect(click).toMatchObject({
      affiliate_id: 'affiliate-1',
    });
    expect(click).not.toHaveProperty('ip_address');
    expect(click).not.toHaveProperty('user_agent');
    expect(click).not.toHaveProperty('referrer_url');
    expect(click).not.toHaveProperty('utm_source');
    expect(click).not.toHaveProperty('utm_medium');
    expect(click).not.toHaveProperty('utm_campaign');
    expect(affiliate.total_clicks).toBe(1);
    expect(clickRepository.save).toHaveBeenCalledWith(click);
    expect(affiliateRepository.save).toHaveBeenCalledWith(affiliate);
  });

  it('tracks affiliate conversion exactly once for a replayed click', async () => {
    const affiliate = {
      id: 'affiliate-1',
      user_id: 'creator-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_signups: 0,
      total_conversions: 0,
    };
    const click = {
      id: 'click-1',
      affiliate_id: 'affiliate-1',
      affiliate,
      converted: false,
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>([click]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await service.trackConversion(' click-1 ', ' user-1 ');
    click.converted_user_id = ' user-1 ';
    await service.trackConversion('click-1', 'user-1');

    expect(click.converted).toBe(true);
    expect(click.converted_user_id).toBe(' user-1 ');
    expect(affiliate.total_signups).toBe(1);
    expect(affiliate.total_conversions).toBe(1);
    expect(clickRepository.save).toHaveBeenCalledTimes(1);
    expect(affiliateRepository.save).toHaveBeenCalledTimes(1);
    await expect(service.trackConversion('click-1', 'user-2')).rejects.toThrow(
      'Click already converted by a different user'
    );
  });

  it('rejects malformed affiliate conversion identifiers before click lookup', async () => {
    const affiliate = {
      id: 'affiliate-1',
      user_id: 'creator-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_signups: 0,
      total_conversions: 0,
    };
    const clickRepository = createRepository<any>([
      {
        id: 'click-1',
        affiliate_id: affiliate.id,
        affiliate,
        converted: false,
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackConversion('   ', 'user-1')).rejects.toThrow(
      'Affiliate click id must be a non-empty string'
    );
    await expect(service.trackConversion('click-1', '   ')).rejects.toThrow(
      'Affiliate converted_user_id must be a non-empty string'
    );
    expect(clickRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects corrupt affiliate conversion click rows before replay or counter mutation', async () => {
    const approvedAffiliate = {
      id: 'affiliate-1',
      user_id: 'creator-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_signups: 0,
      total_conversions: 0,
    };
    const overConvertedAffiliate = {
      id: 'affiliate-over-converted-replay',
      user_id: 'creator-over-converted',
      affiliate_code: 'OVERCONVERTED',
      status: 'approved',
      total_signups: 0,
      total_conversions: 1,
    };
    const mismatchedRelationAffiliate = {
      id: 'affiliate-elsewhere',
      user_id: 'creator-elsewhere',
      affiliate_code: 'OTHER',
      status: 'approved',
      total_signups: 0,
      total_conversions: 0,
    };
    const cases = [
      {
        click: [] as any,
        forceReturnedRow: true,
        expectedError: 'Affiliate conversion click must be an object',
      },
      {
        click: {
          id: 'click-elsewhere',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        forceReturnedRow: true,
        expectedError: 'Affiliate conversion click id must match requested click',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          created_at: new Date('2026-06-10T00:00:00.000Z'),
          provider_trace_id: 'trace-123',
        },
        expectedError: 'Affiliate conversion click click-1 include unsupported field(s): provider_trace_id',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: {
            ...approvedAffiliate,
            provider_trace_id: 'trace-123',
          },
          converted: false,
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion relation affiliate-1 include unsupported field(s): provider_trace_id',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: true,
          converted_user_id: 'user-1',
          converted_at: new Date('2026-06-09T23:59:59.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 converted_at cannot be before created_at',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          updated_at: new Date('2026-06-09T23:59:59.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 updated_at cannot be before created_at',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: true,
          converted_user_id: 'user-1',
          converted_at: new Date('2026-06-10T01:00:00.000Z'),
          updated_at: new Date('2026-06-10T00:59:59.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 updated_at cannot be before converted_at',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: true,
          converted_user_id: 'user-1',
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 converted_at is required when converted',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          converted: true,
          converted_user_id: 'user-1',
          converted_at: new Date('2026-06-10T01:00:00.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate click is missing affiliate relation',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: mismatchedRelationAffiliate,
          converted: true,
          converted_user_id: 'user-1',
          converted_at: new Date('2026-06-10T01:00:00.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click affiliate relation id must match click affiliate_id',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: {
            ...approvedAffiliate,
            user_id: '   ',
          },
          converted: false,
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion relation affiliate-1 user_id must be a non-empty string',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          converted_user_id: 'user-stale',
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 converted_user_id cannot be present before converted',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          converted_at: new Date('2026-06-10T01:00:00.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click click-1 converted_at cannot be present before converted',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: mismatchedRelationAffiliate,
          converted: false,
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Affiliate conversion click affiliate relation id must match click affiliate_id',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: approvedAffiliate.id,
          affiliate: approvedAffiliate,
          converted: false,
          created_at: 'not-a-date',
        },
        expectedError: 'Affiliate conversion click click-1 created_at must be a valid Date',
      },
      {
        click: {
          id: 'click-1',
          affiliate_id: overConvertedAffiliate.id,
          affiliate: overConvertedAffiliate,
          converted: true,
          converted_user_id: 'user-1',
          converted_at: new Date('2026-06-10T01:00:00.000Z'),
          created_at: new Date('2026-06-10T00:00:00.000Z'),
        },
        expectedError: 'Total conversions for affiliate affiliate-over-converted-replay cannot exceed total signups',
      },
    ];

    for (const scenario of cases) {
      const affiliateRepository = createRepository<any>([
        { ...approvedAffiliate },
        { ...overConvertedAffiliate },
        { ...mismatchedRelationAffiliate },
      ]);
      const click = Array.isArray(scenario.click) ? scenario.click : { ...scenario.click };
      const clickRepository = createRepository<any>([click]);
      if (scenario.forceReturnedRow) {
        clickRepository.findOne = jest.fn(async () => click);
      }
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: clickRepository as any,
        payoutRepository: createRepository() as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.trackConversion('click-1', 'user-1')).rejects.toThrow(scenario.expectedError);
      expect(clickRepository.save).not.toHaveBeenCalled();
      expect(affiliateRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects conversions for stale or corrupt affiliate statuses before mutating click state', async () => {
    const pendingAffiliate = {
      id: 'affiliate-pending',
      user_id: 'creator-pending',
      affiliate_code: 'PENDING',
      status: 'pending',
      total_signups: 0,
      total_conversions: 0,
    };
    const corruptAffiliate = {
      id: 'affiliate-corrupt',
      user_id: 'creator-corrupt',
      affiliate_code: 'CORRUPT',
      status: 'mystery',
      total_signups: 0,
      total_conversions: 0,
    };
    const pendingClick = {
      id: 'click-pending',
      affiliate_id: pendingAffiliate.id,
      affiliate: pendingAffiliate,
      converted: false,
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const pendingReplayClick = {
      id: 'click-pending-replay',
      affiliate_id: pendingAffiliate.id,
      affiliate: pendingAffiliate,
      converted: true,
      converted_user_id: 'user-1',
      converted_at: new Date('2026-06-10T01:00:00.000Z'),
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const corruptClick = {
      id: 'click-corrupt',
      affiliate_id: corruptAffiliate.id,
      affiliate: corruptAffiliate,
      converted: false,
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const corruptReplayClick = {
      id: 'click-corrupt-replay',
      affiliate_id: corruptAffiliate.id,
      affiliate: corruptAffiliate,
      converted: true,
      converted_user_id: 'user-1',
      converted_at: new Date('2026-06-10T01:00:00.000Z'),
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const affiliateRepository = createRepository<any>([pendingAffiliate, corruptAffiliate]);
    const clickRepository = createRepository<any>([
      pendingClick,
      pendingReplayClick,
      corruptClick,
      corruptReplayClick,
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackConversion('click-pending', 'user-1')).rejects.toThrow(
      'Affiliate is not approved'
    );
    await expect(service.trackConversion('click-pending-replay', 'user-1')).rejects.toThrow(
      'Affiliate is not approved'
    );
    await expect(service.trackConversion('click-corrupt', 'user-1')).rejects.toThrow(
      'Affiliate affiliate-corrupt status must be pending, approved, rejected, or suspended'
    );
    await expect(service.trackConversion('click-corrupt-replay', 'user-1')).rejects.toThrow(
      'Affiliate affiliate-corrupt status must be pending, approved, rejected, or suspended'
    );

    expect(pendingClick.converted).toBe(false);
    expect(corruptClick.converted).toBe(false);
    expect((pendingClick as any).converted_user_id).toBeUndefined();
    expect((corruptClick as any).converted_user_id).toBeUndefined();
    expect(pendingAffiliate.total_signups).toBe(0);
    expect(corruptAffiliate.total_signups).toBe(0);
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects conversion clicks missing the affiliate relation before mutating click state', async () => {
    const click = {
      id: 'click-missing-affiliate-relation',
      affiliate_id: 'affiliate-missing-relation',
      converted: false,
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const affiliateRepository = createRepository<any>();
    const clickRepository = createRepository<any>([click]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.trackConversion('click-missing-affiliate-relation', 'user-1')
    ).rejects.toThrow('Affiliate click is missing affiliate relation');

    expect(clickRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'click-missing-affiliate-relation' },
      relations: ['affiliate'],
    });
    expect(click.converted).toBe(false);
    expect((click as any).converted_user_id).toBeUndefined();
    expect((click as any).converted_at).toBeUndefined();
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects click counter overflow before creating or saving a click', async () => {
    const affiliate = {
      id: 'affiliate-click-overflow',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: Number.MAX_SAFE_INTEGER,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackClick('BLOGGER', {})).rejects.toThrow(
      'Total clicks for affiliate affiliate-click-overflow must remain a safe integer after increment'
    );

    expect(clickRepository.create).not.toHaveBeenCalled();
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_clicks).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects conversion counter overflow before mutating or saving the click', async () => {
    const affiliate = {
      id: 'affiliate-conversion-overflow',
      user_id: 'creator-overflow',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_signups: Number.MAX_SAFE_INTEGER,
      total_conversions: 4,
    };
    const click = {
      id: 'click-overflow',
      affiliate_id: affiliate.id,
      affiliate,
      converted: false,
      created_at: new Date('2026-06-10T00:00:00.000Z'),
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>([click]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.trackConversion('click-overflow', 'user-1')).rejects.toThrow(
      'Total signups for affiliate affiliate-conversion-overflow must remain a safe integer after increment'
    );

    expect(click.converted).toBe(false);
    expect((click as any).converted_user_id).toBeUndefined();
    expect((click as any).converted_at).toBeUndefined();
    expect(clickRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_signups).toBe(Number.MAX_SAFE_INTEGER);
    expect(affiliate.total_conversions).toBe(4);
  });

  it('uses decimal-string commission rates and accumulates money in cents for approved affiliates', async () => {
    const affiliate = {
      id: 'affiliate-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      seller_commission_rate: '5.50',
      customer_commission_rate: '2.25',
      total_gmv_cents: '1000',
      total_commission_earned_cents: '100',
      total_commission_paid_cents: '50',
      pending_commission_cents: '25',
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.calculateCommission(' affiliate-1 ', 20000, ' seller ' as any)).resolves.toBe(1100);

    expect(affiliateRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'affiliate-1' },
    });
    expect(affiliate.total_gmv_cents).toBe(21000);
    expect(affiliate.total_commission_earned_cents).toBe(1200);
    expect(affiliate.total_commission_paid_cents).toBe('50');
    expect(affiliate.pending_commission_cents).toBe(1125);
    expect(affiliateRepository.save).toHaveBeenCalledWith(affiliate);
  });

  it('rejects cross-affiliate commission rows before writing commission updates', async () => {
    const crossAffiliate = {
      id: 'affiliate-elsewhere',
      affiliate_code: 'ELSEWHERE',
      status: 'approved',
      seller_commission_rate: '5.00',
      total_gmv_cents: 1000,
      total_commission_earned_cents: 100,
      pending_commission_cents: 25,
    };
    const affiliateRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => crossAffiliate),
    };
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.calculateCommission('affiliate-1', 20000, 'seller')).rejects.toThrow(
      'Affiliate commission source affiliate-elsewhere id must match requested affiliate'
    );

    expect(affiliateRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'affiliate-1' },
    });
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(crossAffiliate.total_gmv_cents).toBe(1000);
    expect(crossAffiliate.total_commission_earned_cents).toBe(100);
    expect(crossAffiliate.pending_commission_cents).toBe(25);
  });

  it('rejects malformed affiliate commission inputs before repository reads', async () => {
    const affiliateRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.calculateCommission('   ', 10000, 'seller')).rejects.toThrow(
      'Affiliate commission affiliate_id must be a non-empty string'
    );
    await expect(service.calculateCommission('affiliate-1', 10000, 'partner' as any)).rejects.toThrow(
      'Affiliate commission type must be seller or customer'
    );

    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt affiliate commission statuses before writing commission updates', async () => {
    const affiliate = {
      id: 'affiliate-corrupt-commission-status',
      affiliate_code: 'BLOGGER',
      status: 'mystery',
      seller_commission_rate: '5.00',
      total_gmv_cents: 1000,
      total_commission_earned_cents: 100,
      pending_commission_cents: 25,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.calculateCommission('affiliate-corrupt-commission-status', 20000, 'seller')
    ).rejects.toThrow(
      'Affiliate affiliate-corrupt-commission-status status must be pending, approved, rejected, or suspended'
    );

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe(1000);
    expect(affiliate.total_commission_earned_cents).toBe(100);
    expect(affiliate.pending_commission_cents).toBe(25);
  });

  it('rejects unsupported persisted affiliate commission fields before writing commission updates', async () => {
    const affiliate = {
      id: 'affiliate-provider-commission-row',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      seller_commission_rate: '5.00',
      total_gmv_cents: 1000,
      total_commission_earned_cents: 100,
      total_commission_paid_cents: 50,
      pending_commission_cents: 25,
      provider_trace_id: 'trace-123',
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.calculateCommission('affiliate-provider-commission-row', 20000, 'seller')
    ).rejects.toThrow(
      'Affiliate commission source affiliate-provider-commission-row include unsupported field(s): provider_trace_id'
    );

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe(1000);
    expect(affiliate.total_commission_earned_cents).toBe(100);
    expect(affiliate.pending_commission_cents).toBe(25);
  });

  it('rejects corrupt inactive affiliate commission counters before returning zero commission', async () => {
    const affiliate = {
      id: 'affiliate-inactive-corrupt-commission',
      affiliate_code: 'BLOGGER',
      status: 'pending',
      seller_commission_rate: '5.00',
      total_gmv_cents: 'not-a-number',
      total_commission_earned_cents: 100,
      total_commission_paid_cents: 50,
      pending_commission_cents: 25,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.calculateCommission('affiliate-inactive-corrupt-commission', 20000, 'seller')
    ).rejects.toThrow(
      'Total GMV for affiliate affiliate-inactive-corrupt-commission must be a non-negative integer amount in cents'
    );

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe('not-a-number');
    expect(affiliate.total_commission_earned_cents).toBe(100);
    expect(affiliate.total_commission_paid_cents).toBe(50);
    expect(affiliate.pending_commission_cents).toBe(25);
  });

  it('rejects corrupt affiliate commission counters before writing commission updates', async () => {
    const affiliate = {
      id: 'affiliate-corrupt-commission',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      seller_commission_rate: '5.00',
      total_gmv_cents: 'not-a-number',
      total_commission_earned_cents: 100,
      total_commission_paid_cents: 50,
      pending_commission_cents: 25,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.calculateCommission('affiliate-corrupt-commission', 20000, 'seller')).rejects.toThrow(
      'Total GMV for affiliate affiliate-corrupt-commission must be a non-negative integer amount in cents'
    );

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe('not-a-number');
    expect(affiliate.total_commission_earned_cents).toBe(100);
    expect(affiliate.total_commission_paid_cents).toBe(50);
    expect(affiliate.pending_commission_cents).toBe(25);
  });

  it('rejects affiliate commission source rows whose pending commission exceeds unpaid earned commission', async () => {
    const cases = [
      {
        affiliate: {
          id: 'affiliate-overearned-commission',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          seller_commission_rate: '5.00',
          total_gmv_cents: 1000,
          total_commission_earned_cents: 1001,
          total_commission_paid_cents: 0,
          pending_commission_cents: 0,
        },
        message: 'Total commission earned for affiliate affiliate-overearned-commission cannot exceed total GMV',
      },
      {
        affiliate: {
          id: 'affiliate-overpaid-commission',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          seller_commission_rate: '5.00',
          total_gmv_cents: 1000,
          total_commission_earned_cents: 100,
          total_commission_paid_cents: 101,
          pending_commission_cents: 0,
        },
        message: 'Total commission paid for affiliate affiliate-overpaid-commission cannot exceed total commission earned',
      },
      {
        affiliate: {
          id: 'affiliate-overpending-commission',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          seller_commission_rate: '5.00',
          total_gmv_cents: 1000,
          total_commission_earned_cents: 100,
          total_commission_paid_cents: 80,
          pending_commission_cents: 21,
        },
        message: 'Pending commission for affiliate affiliate-overpending-commission cannot exceed unpaid earned commission',
      },
    ];

    for (const { affiliate, message } of cases) {
      const originalGmvCents = affiliate.total_gmv_cents;
      const originalEarnedCents = affiliate.total_commission_earned_cents;
      const originalPendingCents = affiliate.pending_commission_cents;
      const affiliateRepository = createRepository<any>([affiliate]);
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.calculateCommission(affiliate.id, 20000, 'seller')).rejects.toThrow(message);

      expect(affiliateRepository.save).not.toHaveBeenCalled();
      expect(affiliate.total_gmv_cents).toBe(originalGmvCents);
      expect(affiliate.total_commission_earned_cents).toBe(originalEarnedCents);
      expect(affiliate.pending_commission_cents).toBe(originalPendingCents);
    }
  });

  it('rejects affiliate commission totals that overflow safe cent arithmetic before writing updates', async () => {
    const affiliate = {
      id: 'affiliate-overflow-commission',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      seller_commission_rate: '100.00',
      total_gmv_cents: Number.MAX_SAFE_INTEGER,
      total_commission_earned_cents: 0,
      total_commission_paid_cents: 0,
      pending_commission_cents: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.calculateCommission('affiliate-overflow-commission', 1, 'seller')
    ).rejects.toThrow('Total GMV for affiliate affiliate-overflow-commission must be a safe integer amount in cents');

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe(Number.MAX_SAFE_INTEGER);
    expect(affiliate.total_commission_earned_cents).toBe(0);
    expect(affiliate.total_commission_paid_cents).toBe(0);
    expect(affiliate.pending_commission_cents).toBe(0);
  });

  it('rejects unsafe affiliate commission scaled products before mutating counters', async () => {
    const affiliate = {
      id: 'affiliate-scaled-overflow-commission',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      seller_commission_rate: '100.00',
      total_gmv_cents: 0,
      total_commission_earned_cents: 0,
      total_commission_paid_cents: 0,
      pending_commission_cents: 0,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.calculateCommission('affiliate-scaled-overflow-commission', Number.MAX_SAFE_INTEGER, 'seller')
    ).rejects.toThrow('Affiliate commission scaled amount must be a safe finite amount before rounding');

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(affiliate.total_gmv_cents).toBe(0);
    expect(affiliate.total_commission_earned_cents).toBe(0);
    expect(affiliate.total_commission_paid_cents).toBe(0);
    expect(affiliate.pending_commission_cents).toBe(0);
  });

  it('normalizes affiliate dashboard user ids before affiliate lookup', async () => {
    const affiliate = {
      id: 'affiliate-dashboard',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const clickRepository = createRepository<any>([
      {
        id: 'click-dashboard-1',
        affiliate_id: 'affiliate-dashboard',
        ip_address: '203.0.113.10',
        user_agent: 'Mozilla/5.0',
        referrer_url: 'https://example.com/blog/launch',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'launch-week',
        converted: true,
        converted_user_id: 'user-converted-1',
        converted_at: new Date('2026-06-15T00:00:00.000Z'),
        created_at: new Date('2026-06-10T00:00:00.000Z'),
      },
    ]);
    const payoutRepository = createRepository<any>([
      {
        id: 'payout-dashboard-1',
        affiliate_id: 'affiliate-dashboard',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: 'provider-dashboard-settlement-1',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    const dashboard = await service.getAffiliateDashboard('  user-1  ');

    expect(affiliateRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    expect(dashboard.affiliate).toBe(affiliate);
    expect(dashboard.stats.total_clicks).toBe(10);
    expect(dashboard.recent_clicks).toHaveLength(1);
    expect(dashboard.recent_clicks[0]).toMatchObject({
      id: 'click-dashboard-1',
      affiliate_id: 'affiliate-dashboard',
      converted: true,
    });
    expect(clickRepository.find).toHaveBeenCalledWith({
      where: { affiliate_id: 'affiliate-dashboard' },
      order: { created_at: 'DESC' },
      take: 10,
    });
    expect(payoutRepository.find).toHaveBeenCalledWith({
      where: { affiliate_id: 'affiliate-dashboard' },
      order: { created_at: 'DESC' },
      take: 10,
    });
    expect(dashboard.recent_payouts).toHaveLength(1);
    expect(dashboard.recent_payouts[0]).toMatchObject({
      id: 'payout-dashboard-1',
      payout_month: '2026-06',
      status: 'paid',
    });
  });

  it('rejects malformed affiliate dashboard click IP addresses before returning recent activity', async () => {
    const affiliate = {
      id: 'affiliate-dashboard',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>([
      {
        id: 'click-dashboard-invalid-ip',
        affiliate_id: 'affiliate-dashboard',
        ip_address: '203.0.113.10/24',
        converted: false,
        created_at: new Date('2026-06-10T00:00:00.000Z'),
      },
    ]);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 IP address must be a valid IPv4 or IPv6 address'
    );

    expect(clickRepository.find).toHaveBeenCalledWith({
      where: { affiliate_id: 'affiliate-dashboard' },
      order: { created_at: 'DESC' },
      take: 10,
    });
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects blank affiliate dashboard user ids before repository reads', async () => {
    const affiliateRepository = createRepository<any>();
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('   ')).rejects.toThrow(
      'Affiliate dashboard user_id must be a non-empty string'
    );

    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects cross-user affiliate dashboard rows before reading recent activity', async () => {
    const affiliate = {
      id: 'affiliate-cross-dashboard',
      user_id: 'user-elsewhere',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const affiliateRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => affiliate),
    };
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate dashboard source affiliate-cross-dashboard user_id must match requested user'
    );

    expect(affiliateRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects unsupported persisted affiliate dashboard fields before reading recent activity', async () => {
    const affiliate = {
      id: 'affiliate-provider-dashboard',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
      provider_trace_id: 'trace-123',
    };
    const affiliateRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => affiliate),
    };
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate dashboard source affiliate-provider-dashboard include unsupported field(s): provider_trace_id'
    );

    affiliateRepository.findOne.mockResolvedValueOnce({
      ...affiliate,
      provider_trace_id: undefined,
      ['provider_trace_id\uFEFF']: 'trace-123',
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate dashboard source affiliate-provider-dashboard field names must not include unsafe control characters'
    );

    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects corrupt affiliate dashboard identity fields before reading recent activity', async () => {
    const cases = [
      {
        affiliate: {
          id: 'affiliate-bad-code-dashboard',
          user_id: 'user-1',
          affiliate_code: 'blogger',
          status: 'approved',
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Affiliate dashboard source affiliate-bad-code-dashboard affiliate_code must contain only uppercase letters, numbers, and underscores',
      },
      {
        affiliate: {
          id: 'affiliate-bad-status-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'mystery',
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Affiliate dashboard source affiliate-bad-status-dashboard status must be pending, approved, rejected, or suspended',
      },
      {
        affiliate: {
          id: 'affiliate-oversized-youtube-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          youtube_channel: 'y'.repeat(256),
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Affiliate dashboard source affiliate-oversized-youtube-dashboard youtube_channel must be at most 255 characters',
      },
    ];

    for (const { affiliate, message } of cases) {
      const clickRepository = createRepository<any>();
      const payoutRepository = createRepository<any>();
      const service = new AffiliateService({
        affiliateRepository: createRepository<any>([affiliate]) as any,
        clickRepository: clickRepository as any,
        payoutRepository: payoutRepository as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(message);

      expect(clickRepository.find).not.toHaveBeenCalled();
      expect(payoutRepository.find).not.toHaveBeenCalled();
    }
  });

  it('rejects corrupt affiliate dashboard counters before returning payout stats', async () => {
    const affiliate = {
      id: 'affiliate-corrupt-dashboard',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 'not-a-number',
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Total commission paid for affiliate affiliate-corrupt-dashboard must be a non-negative integer amount in cents'
    );

    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects impossible affiliate dashboard commission balances before reading recent activity', async () => {
    const cases = [
      {
        affiliate: {
          id: 'affiliate-overearned-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 100001,
          total_commission_paid_cents: 0,
          pending_commission_cents: 0,
        },
        message: 'Total commission earned for affiliate affiliate-overearned-dashboard cannot exceed total GMV',
      },
      {
        affiliate: {
          id: 'affiliate-overpaid-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 5001,
          pending_commission_cents: 0,
        },
        message: 'Total commission paid for affiliate affiliate-overpaid-dashboard cannot exceed total commission earned',
      },
      {
        affiliate: {
          id: 'affiliate-overpending-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 10,
          total_signups: 4,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2501,
        },
        message: 'Pending commission for affiliate affiliate-overpending-dashboard cannot exceed unpaid earned commission',
      },
    ];

    for (const { affiliate, message } of cases) {
      const clickRepository = createRepository<any>();
      const payoutRepository = createRepository<any>();
      const service = new AffiliateService({
        affiliateRepository: createRepository<any>([affiliate]) as any,
        clickRepository: clickRepository as any,
        payoutRepository: payoutRepository as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(message);

      expect(clickRepository.find).not.toHaveBeenCalled();
      expect(payoutRepository.find).not.toHaveBeenCalled();
    }
  });

  it('rejects unsafe affiliate dashboard counters before reading recent activity', async () => {
    const affiliate = {
      id: 'affiliate-unsafe-dashboard',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: Number.MAX_SAFE_INTEGER + 1,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Total clicks for affiliate affiliate-unsafe-dashboard must be a safe integer'
    );

    expect(clickRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects impossible affiliate dashboard conversion counters before reading recent activity', async () => {
    const cases = [
      {
        affiliate: {
          id: 'affiliate-over-signup-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 2,
          total_signups: 3,
          total_conversions: 2,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Total signups for affiliate affiliate-over-signup-dashboard cannot exceed total clicks',
      },
      {
        affiliate: {
          id: 'affiliate-over-conversion-click-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 2,
          total_signups: 2,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Total conversions for affiliate affiliate-over-conversion-click-dashboard cannot exceed total clicks',
      },
      {
        affiliate: {
          id: 'affiliate-over-conversion-signup-dashboard',
          user_id: 'user-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          total_clicks: 4,
          total_signups: 2,
          total_conversions: 3,
          total_gmv_cents: 100000,
          total_commission_earned_cents: 5000,
          total_commission_paid_cents: 2500,
          pending_commission_cents: 2500,
        },
        message: 'Total conversions for affiliate affiliate-over-conversion-signup-dashboard cannot exceed total signups',
      },
    ];

    for (const { affiliate, message } of cases) {
      const clickRepository = createRepository<any>();
      const payoutRepository = createRepository<any>();
      const service = new AffiliateService({
        affiliateRepository: createRepository<any>([affiliate]) as any,
        clickRepository: clickRepository as any,
        payoutRepository: payoutRepository as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(message);

      expect(clickRepository.find).not.toHaveBeenCalled();
      expect(payoutRepository.find).not.toHaveBeenCalled();
    }
  });

  it('rejects duplicate affiliate dashboard payout months before returning payout history', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-duplicate-payout-month',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 5000,
      pending_commission_cents: 0,
    };
    const payoutRepository = createRepository<any>([
      {
        id: 'payout-dashboard-june-original',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-month',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: 'provider-dashboard-june-original',
      },
      {
        id: 'payout-dashboard-june-duplicate',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-month',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-30T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:05:00.000Z'),
        transaction_id: 'provider-dashboard-june-duplicate',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: createRepository<any>() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 2 payout_month must be unique for affiliate affiliate-dashboard-duplicate-payout-month'
    );
  });

  it('rejects duplicate affiliate dashboard payout ids before returning payout history', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-duplicate-payout-id',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 5000,
      pending_commission_cents: 0,
    };
    const payoutRepository = createRepository<any>([
      {
        id: 'payout-dashboard-duplicate-id',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-id',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: 'provider-dashboard-duplicate-id-june',
      },
      {
        id: 'payout-dashboard-duplicate-id',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-id',
        payout_month: '2026-07',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-07-29T00:00:00.000Z'),
        paid_at: new Date('2026-07-30T00:00:00.000Z'),
        transaction_id: 'provider-dashboard-duplicate-id-july',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: createRepository<any>() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 2 id must be unique for affiliate affiliate-dashboard-duplicate-payout-id'
    );
  });

  it('rejects duplicate affiliate dashboard payout transaction ids before returning payout history', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-duplicate-payout-transaction',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 5000,
      pending_commission_cents: 0,
    };
    const payoutRepository = createRepository<any>([
      {
        id: 'payout-dashboard-june',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-transaction',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: 'provider-dashboard-settlement-reused',
      },
      {
        id: 'payout-dashboard-july',
        affiliate_id: 'affiliate-dashboard-duplicate-payout-transaction',
        payout_month: '2026-07',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-07-29T00:00:00.000Z'),
        paid_at: new Date('2026-07-30T00:00:00.000Z'),
        transaction_id: ' provider-dashboard-settlement-reused ',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: createRepository<any>() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 2 transaction_id must be unique for affiliate affiliate-dashboard-duplicate-payout-transaction'
    );
  });

  it('rejects corrupt affiliate dashboard payout rows before returning reward activity', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-payout-corrupt',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>();
    const payoutRepository = createRepository<any>([
      {
        id: 'payout-provider-row',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'upi',
        provider_trace_id: 'trace-123',
      },
      {
        id: 'payout-provider-field-name',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'upi',
        ['provider_trace_id\uFEFF']: 'trace-123',
      },
      {
        id: 'payout-cross-affiliate',
        affiliate_id: 'affiliate-other',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
      },
      {
        id: 'payout-bad-status',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'teleported',
        payout_method: 'upi',
      },
      {
        id: 'payout-stale-total',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2501,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'upi',
      },
      {
        id: 'payout-missing-method',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
      },
      {
        id: 'payout-paid-missing-evidence',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
      },
      {
        id: 'payout-paid-blank-transaction',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: '   ',
      },
      {
        id: 'payout-paid-oversized-transaction',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
        transaction_id: `provider-${'x'.repeat(256)}`,
      },
      {
        id: 'payout-paid-missing-transaction',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
      },
      {
        id: 'payout-processing-stale-transaction',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'processing',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        transaction_id: 'provider-settlement-123',
      },
      {
        id: 'payout-pending-stale-paid-evidence',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        paid_at: new Date('2026-06-30T00:00:00.000Z'),
      },
      {
        id: 'payout-paid-before-created',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-30T00:00:00.000Z'),
        paid_at: new Date('2026-06-29T23:59:59.000Z'),
        transaction_id: 'provider-settlement-before-created',
      },
      {
        id: 'payout-updated-before-created',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'upi',
        created_at: new Date('2026-06-30T00:00:00.000Z'),
        updated_at: new Date('2026-06-29T23:59:59.000Z'),
      },
      {
        id: 'payout-updated-before-paid',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'paid',
        payout_method: 'upi',
        created_at: new Date('2026-06-30T00:00:00.000Z'),
        updated_at: new Date('2026-06-30T00:04:59.999Z'),
        paid_at: new Date('2026-06-30T00:05:00.000Z'),
        transaction_id: 'provider-settlement-after-update',
      },
      {
        id: 'payout-failed-missing-evidence',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'failed',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
      },
      {
        id: 'payout-failed-oversized-reason',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'failed',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        failure_reason: `provider-${'x'.repeat(1001)}`,
      },
      {
        id: 'payout-processing-stale-failure-evidence',
        affiliate_id: 'affiliate-dashboard-payout-corrupt',
        payout_month: '2026-06',
        payout_amount_cents: 2500,
        seller_referrals_count: 1,
        seller_gmv_cents: 50000,
        seller_commission_cents: 2500,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'processing',
        payout_method: 'upi',
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        failure_reason: 'Previous bank-transfer failure',
      },
    ]);
    payoutRepository.find = jest.fn(async () => payoutRepository.rows);
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 1 include unsupported field(s): provider_trace_id'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 1 field names must not include unsafe control characters'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 1 affiliate_id must match dashboard affiliate'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 1 status must be pending, processing, paid, or failed'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-stale-total payout_amount_cents must equal seller plus customer commission'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Payout method for affiliate payout payout-missing-method must be a non-empty string'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-paid-missing-evidence paid status requires paid_at evidence'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Transaction id for affiliate payout payout-paid-blank-transaction must be a non-empty string'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Transaction id for affiliate payout payout-paid-oversized-transaction must be at most 255 characters'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-paid-missing-transaction paid status requires transaction_id evidence'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-processing-stale-transaction transaction_id evidence cannot be present before paid status'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-pending-stale-paid-evidence paid_at evidence cannot be present before paid status'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-paid-before-created paid_at evidence cannot be before payout creation'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-updated-before-created updated_at evidence cannot be before payout creation'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-updated-before-paid updated_at evidence cannot be before paid_at'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-failed-missing-evidence failed status requires failure_reason evidence'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Failure reason for affiliate payout payout-failed-oversized-reason must be at most 1000 characters'
    );

    payoutRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout payout-processing-stale-failure-evidence failure_reason evidence cannot be present before failed status'
    );
  });

  it('rejects malformed affiliate dashboard payout envelopes before returning reward activity', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-payout-envelope',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const payoutRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [[] as any]),
    };
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: createRepository<any>() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate payout dashboard row 1 must be an object'
    );
  });

  it('rejects corrupt affiliate dashboard click rows before returning recent activity', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-click-corrupt',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>([
      [] as any,
      {
        id: 'click-provider-row',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: false,
        created_at: new Date('2026-06-09T00:00:00.000Z'),
        provider_trace_id: 'trace-123',
      },
      {
        id: 'click-provider-field-name',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: false,
        created_at: new Date('2026-06-09T00:00:00.000Z'),
        ['provider_trace_id\uFEFF']: 'trace-123',
      },
      {
        id: 'click-cross-affiliate',
        affiliate_id: 'affiliate-other',
        converted: false,
        created_at: new Date('2026-06-10T00:00:00.000Z'),
      },
      {
        id: 'click-bad-converted',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: 'yes',
        created_at: new Date('2026-06-11T00:00:00.000Z'),
      },
      {
        id: 'click-converted-missing-date',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: true,
        converted_user_id: 'user-converted-1',
        created_at: new Date('2026-06-12T00:00:00.000Z'),
      },
      {
        id: 'click-converted-before-created',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: true,
        converted_user_id: 'user-converted-1',
        converted_at: new Date('2026-06-12T23:59:59.000Z'),
        created_at: new Date('2026-06-13T00:00:00.000Z'),
      },
      {
        id: 'click-updated-before-created',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: false,
        updated_at: new Date('2026-06-13T23:59:59.000Z'),
        created_at: new Date('2026-06-14T00:00:00.000Z'),
      },
      {
        id: 'click-updated-before-converted',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: true,
        converted_user_id: 'user-converted-1',
        converted_at: new Date('2026-06-15T00:00:00.000Z'),
        updated_at: new Date('2026-06-14T23:59:59.000Z'),
        created_at: new Date('2026-06-14T00:00:00.000Z'),
      },
      {
        id: 'click-unconverted-stale-user',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: false,
        converted_user_id: 'user-stale',
        created_at: new Date('2026-06-13T00:00:00.000Z'),
      },
      {
        id: 'click-unconverted-stale-date',
        affiliate_id: 'affiliate-dashboard-click-corrupt',
        converted: false,
        converted_at: new Date('2026-06-14T00:00:00.000Z'),
        created_at: new Date('2026-06-14T00:00:00.000Z'),
      },
    ]);
    clickRepository.find = jest.fn(async () => clickRepository.rows);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 must be an object'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 include unsupported field(s): provider_trace_id'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 field names must not include unsafe control characters'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 affiliate_id must match dashboard affiliate'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 converted must be a boolean'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 converted_at is required when click click-converted-missing-date is converted'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 converted_at cannot be before click click-converted-before-created was created'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 updated_at cannot be before click click-updated-before-created was created'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 updated_at cannot be before click click-updated-before-converted was converted'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 converted_user_id cannot be present before click click-unconverted-stale-user is converted'
    );

    clickRepository.rows.shift();
    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 1 converted_at cannot be present before click click-unconverted-stale-date is converted'
    );

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects duplicate affiliate dashboard click ids before returning recent activity', async () => {
    const affiliate = {
      id: 'affiliate-dashboard-duplicate-click',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 5000,
      total_commission_paid_cents: 2500,
      pending_commission_cents: 2500,
    };
    const clickRepository = createRepository<any>([
      {
        id: 'click-dashboard-duplicate',
        affiliate_id: 'affiliate-dashboard-duplicate-click',
        converted: true,
        converted_user_id: 'user-converted-1',
        converted_at: new Date('2026-06-12T00:00:00.000Z'),
        created_at: new Date('2026-06-10T00:00:00.000Z'),
      },
      {
        id: 'click-dashboard-duplicate',
        affiliate_id: 'affiliate-dashboard-duplicate-click',
        converted: false,
        created_at: new Date('2026-06-11T00:00:00.000Z'),
      },
    ]);
    clickRepository.find = jest.fn(async () => clickRepository.rows);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: clickRepository as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.getAffiliateDashboard('user-1')).rejects.toThrow(
      'Affiliate click dashboard row 2 id must be unique for affiliate affiliate-dashboard-duplicate-click'
    );

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('creates at most one pending payout for a month and preserves unpaid amount as reserved', async () => {
    const payableAffiliate = {
      id: 'affiliate-payable',
      status: 'approved',
      pending_commission_cents: 150000,
      total_commission_earned_cents: 150000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const duplicateAffiliate = {
      id: 'affiliate-duplicate',
      status: 'approved',
      pending_commission_cents: 200000,
      total_commission_earned_cents: 200000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: 'bank_transfer',
    };
    const tooSmallAffiliate = {
      id: 'affiliate-small',
      status: 'approved',
      pending_commission_cents: 50000,
      total_commission_earned_cents: 50000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
    };
    const affiliateRepository = createRepository<any>([
      payableAffiliate,
      duplicateAffiliate,
      tooSmallAffiliate,
    ]);
    const payoutRepository = createRepository<any>([
      {
        id: 'existing-payout',
        affiliate_id: 'affiliate-duplicate',
        payout_month: '2026-06',
        payout_amount_cents: 200000,
        seller_referrals_count: 0,
        seller_gmv_cents: 0,
        seller_commission_cents: 200000,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: 'bank_transfer',
        created_at: new Date('2026-06-30T00:00:00.000Z'),
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).resolves.toBe(1);

    expect(payoutRepository.save).toHaveBeenCalledTimes(1);
    expect(payoutRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      affiliate_id: 'affiliate-payable',
      payout_month: '2026-06',
      payout_amount_cents: 150000,
      seller_referrals_count: 0,
      seller_gmv_cents: 0,
      seller_commission_cents: 150000,
      customer_referrals_count: 0,
      customer_gmv_cents: 0,
      customer_commission_cents: 0,
      status: 'pending',
      payout_method: 'upi',
    }));
    expect(payableAffiliate.pending_commission_cents).toBe(0);
    expect(duplicateAffiliate.pending_commission_cents).toBe(200000);
    expect(tooSmallAffiliate.pending_commission_cents).toBe(50000);
  });

  it('rejects malformed existing affiliate payout envelopes before skipping monthly settlement', async () => {
    const affiliate = {
      id: 'affiliate-payable',
      user_id: 'user-1',
      affiliate_code: 'BLOGGER',
      status: 'approved',
      total_clicks: 10,
      total_signups: 4,
      total_conversions: 3,
      total_gmv_cents: 100000,
      total_commission_earned_cents: 150000,
      total_commission_paid_cents: 0,
      pending_commission_cents: 150000,
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const payoutRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => [] as any),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Existing affiliate payout must be an object'
    );

    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt existing affiliate payout rows before skipping monthly settlement', async () => {
    const cases = [
      {
        row: {
          id: 'payout-provider-row',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
          provider_trace_id: 'trace-123',
        },
        message: 'Existing affiliate payout payout-provider-row include unsupported field(s): provider_trace_id',
      },
      {
        row: {
          id: 'payout-cross-affiliate',
          affiliate_id: 'affiliate-other',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-cross-affiliate affiliate_id must match payout candidate affiliate',
      },
      {
        row: {
          id: 'payout-cross-month',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-05',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-cross-month payout_month must match requested payout month',
      },
      {
        row: {
          id: 'payout-bad-status',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'teleported',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-bad-status status must be pending, processing, paid, or failed',
      },
      {
        row: {
          id: 'payout-bad-amount',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 'not-a-number',
          status: 'pending',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-bad-amount payout_amount_cents must be a non-negative integer amount in cents',
      },
      {
        row: {
          id: 'payout-stale-amount',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 100000,
          status: 'pending',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-stale-amount payout_amount_cents must match pending commission',
      },
      {
        row: {
          id: 'payout-stale-components',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
          seller_commission_cents: 149999,
          customer_commission_cents: 0,
        },
        message: 'Existing affiliate payout payout-stale-components payout_amount_cents must equal seller plus customer commission',
      },
      {
        row: {
          id: 'payout-bad-seller-referrals',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
          seller_referrals_count: 'many',
        },
        message: 'Seller referrals for existing affiliate payout payout-bad-seller-referrals must be a non-negative integer',
      },
      {
        row: {
          id: 'payout-bad-method',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'crypto',
        },
        message: 'Existing affiliate payout payout-bad-method payout_method must be upi, bank_transfer, or paypal',
      },
      {
        row: {
          id: 'payout-missing-method',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
        },
        message: 'Existing affiliate payout payout-missing-method payout_method must be a non-empty string',
      },
      {
        row: {
          id: 'payout-paid-missing-evidence',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-paid-missing-evidence paid status requires paid_at evidence',
      },
      {
        row: {
          id: 'payout-pending-stale-paid-evidence',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
          paid_at: new Date('2026-06-30T00:00:00.000Z'),
        },
        message: 'Existing affiliate payout payout-pending-stale-paid-evidence paid_at evidence cannot be present before paid status',
      },
      {
        row: {
          id: 'payout-paid-blank-transaction',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          paid_at: new Date('2026-06-30T00:05:00.000Z'),
          transaction_id: '   ',
        },
        message: 'Existing affiliate payout payout-paid-blank-transaction transaction_id must be a non-empty string',
      },
      {
        row: {
          id: 'payout-paid-oversized-transaction',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          paid_at: new Date('2026-06-30T00:05:00.000Z'),
          transaction_id: `provider-${'x'.repeat(256)}`,
        },
        message: 'Existing affiliate payout payout-paid-oversized-transaction transaction_id must be at most 255 characters',
      },
      {
        row: {
          id: 'payout-paid-missing-transaction',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          paid_at: new Date('2026-06-30T00:05:00.000Z'),
        },
        message: 'Existing affiliate payout payout-paid-missing-transaction paid status requires transaction_id evidence',
      },
      {
        row: {
          id: 'payout-processing-stale-transaction',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'processing',
          payout_method: 'upi',
          transaction_id: 'provider-settlement-123',
        },
        message: 'Existing affiliate payout payout-processing-stale-transaction transaction_id evidence cannot be present before paid status',
      },
      {
        row: {
          id: 'payout-paid-before-created',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          paid_at: new Date('2026-06-29T23:59:59.000Z'),
          transaction_id: 'provider-settlement-before-created',
        },
        message: 'Existing affiliate payout payout-paid-before-created paid_at evidence cannot be before payout creation',
      },
      {
        row: {
          id: 'payout-updated-before-created',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'pending',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          updated_at: new Date('2026-06-29T23:59:59.000Z'),
        },
        message: 'Existing affiliate payout payout-updated-before-created updated_at evidence cannot be before payout creation',
      },
      {
        row: {
          id: 'payout-updated-before-paid',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'paid',
          payout_method: 'upi',
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          updated_at: new Date('2026-06-30T00:04:59.999Z'),
          paid_at: new Date('2026-06-30T00:05:00.000Z'),
          transaction_id: 'provider-settlement-after-update',
        },
        message: 'Existing affiliate payout payout-updated-before-paid updated_at evidence cannot be before paid_at',
      },
      {
        row: {
          id: 'payout-failed-missing-evidence',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'failed',
          payout_method: 'upi',
        },
        message: 'Existing affiliate payout payout-failed-missing-evidence failed status requires failure_reason evidence',
      },
      {
        row: {
          id: 'payout-failed-oversized-reason',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'failed',
          payout_method: 'upi',
          failure_reason: `provider-${'x'.repeat(1001)}`,
        },
        message: 'Existing affiliate payout payout-failed-oversized-reason failure_reason must be at most 1000 characters',
      },
      {
        row: {
          id: 'payout-processing-stale-failure-evidence',
          affiliate_id: 'affiliate-payable',
          payout_month: '2026-06',
          payout_amount_cents: 150000,
          status: 'processing',
          payout_method: 'upi',
          failure_reason: 'Bank transfer rejected',
        },
        message: 'Existing affiliate payout payout-processing-stale-failure-evidence failure_reason evidence cannot be present before failed status',
      },
    ];

    for (const { row, message } of cases) {
      const affiliate = {
        id: 'affiliate-payable',
        status: 'approved',
        pending_commission_cents: 150000,
        total_commission_earned_cents: 150000,
        total_commission_paid_cents: 0,
        min_payout_cents: 100000,
        payout_method: 'upi',
      };
      const affiliateRepository = createRepository<any>([affiliate]);
      const payoutRepository = {
        ...createRepository<any>(),
        findOne: jest.fn(async () => ({
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          seller_referrals_count: 0,
          seller_gmv_cents: 0,
          seller_commission_cents: 150000,
          customer_referrals_count: 0,
          customer_gmv_cents: 0,
          customer_commission_cents: 0,
          ...row,
        })),
      };
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: createRepository() as any,
        payoutRepository: payoutRepository as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(message);
      expect(payoutRepository.create).not.toHaveBeenCalled();
      expect(payoutRepository.save).not.toHaveBeenCalled();
      expect(affiliateRepository.save).not.toHaveBeenCalled();
      expect(affiliate.pending_commission_cents).toBe(150000);
    }
  });

  it('rejects invalid affiliate payout money before creating payout records', async () => {
    const invalidAffiliate = {
      id: 'affiliate-invalid',
      status: 'approved',
      pending_commission_cents: 'not-a-number',
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const affiliateRepository = createRepository<any>([invalidAffiliate]);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Pending commission for affiliate affiliate-invalid must be a non-negative integer amount in cents'
    );
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects affiliate payout candidates whose pending commission exceeds unpaid earned commission', async () => {
    const cases = [
      {
        affiliate: {
          id: 'affiliate-overpaid-payout-candidate',
          status: 'approved',
          pending_commission_cents: 0,
          total_commission_earned_cents: 150000,
          total_commission_paid_cents: 150001,
          min_payout_cents: 100000,
          payout_method: 'upi',
        },
        message: 'Total commission paid for affiliate affiliate-overpaid-payout-candidate cannot exceed total commission earned',
      },
      {
        affiliate: {
          id: 'affiliate-overpending-payout-candidate',
          status: 'approved',
          pending_commission_cents: 100001,
          total_commission_earned_cents: 150000,
          total_commission_paid_cents: 50000,
          min_payout_cents: 100000,
          payout_method: 'upi',
        },
        message: 'Pending commission for affiliate affiliate-overpending-payout-candidate cannot exceed unpaid earned commission',
      },
    ];

    for (const { affiliate, message } of cases) {
      const originalPendingCommissionCents = affiliate.pending_commission_cents;
      const affiliateRepository = createRepository<any>([affiliate]);
      const payoutRepository = createRepository<any>();
      const service = new AffiliateService({
        affiliateRepository: affiliateRepository as any,
        clickRepository: createRepository() as any,
        payoutRepository: payoutRepository as any,
        userRepository: createRepository() as any,
        enforceCapability: false,
      });

      await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(message);
      expect(payoutRepository.findOne).not.toHaveBeenCalled();
      expect(payoutRepository.create).not.toHaveBeenCalled();
      expect(payoutRepository.save).not.toHaveBeenCalled();
      expect(affiliateRepository.save).not.toHaveBeenCalled();
      expect(affiliate.pending_commission_cents).toBe(originalPendingCommissionCents);
    }
  });

  it('rejects stale or corrupt affiliate payout candidate rows before payout writes', async () => {
    const providerFieldAffiliate = {
      id: 'affiliate-provider-payout-candidate',
      status: 'approved',
      pending_commission_cents: 150000,
      min_payout_cents: 100000,
      payout_method: 'upi',
      provider_trace_id: 'trace-123',
    };
    const staleAffiliate = {
      id: 'affiliate-stale-payout-candidate',
      status: 'pending',
      pending_commission_cents: 150000,
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const corruptAffiliate = {
      id: 'affiliate-corrupt-payout-candidate',
      status: 'teleported',
      pending_commission_cents: 150000,
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const staleTimestampAffiliate = {
      id: 'affiliate-stale-timestamp-payout-candidate',
      status: 'approved',
      pending_commission_cents: 150000,
      min_payout_cents: 100000,
      payout_method: 'upi',
      created_at: new Date('2026-06-30T00:00:00.000Z'),
      updated_at: new Date('2026-06-29T23:59:59.000Z'),
    };
    const affiliateRepository = createRepository<any>([
      providerFieldAffiliate,
      staleAffiliate,
      corruptAffiliate,
      staleTimestampAffiliate,
    ]);
    affiliateRepository.find = jest.fn(async () => affiliateRepository.rows);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 1 include unsupported field(s): provider_trace_id'
    );

    affiliateRepository.rows.shift();
    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 1 status must match approved affiliate query for affiliate affiliate-stale-payout-candidate'
    );

    affiliateRepository.rows.shift();
    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 1 status must be pending, approved, rejected, or suspended'
    );

    affiliateRepository.rows.shift();
    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 1 updated_at cannot be before created_at'
    );

    expect(payoutRepository.findOne).not.toHaveBeenCalled();
    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed affiliate payout candidate envelopes before payout writes', async () => {
    const affiliateRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [null]),
    };
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 1 must be an object'
    );

    expect(payoutRepository.findOne).not.toHaveBeenCalled();
    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
  });

  it('validates all affiliate payout candidates before writing any monthly payout', async () => {
    const payableAffiliate = {
      id: 'affiliate-payable-before-corrupt',
      status: 'approved',
      pending_commission_cents: 150000,
      total_commission_earned_cents: 150000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: 'upi',
    };
    const corruptLaterAffiliate = {
      id: 'affiliate-corrupt-later',
      status: 'approved',
      pending_commission_cents: 200000,
      total_commission_earned_cents: 200000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: 'bank_transfer',
      provider_trace_id: 'trace-123',
    };
    const affiliateRepository = createRepository<any>([
      payableAffiliate,
      corruptLaterAffiliate,
    ]);
    affiliateRepository.find = jest.fn(async () => affiliateRepository.rows);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Affiliate payout candidate row 2 include unsupported field(s): provider_trace_id'
    );

    expect(payoutRepository.findOne).not.toHaveBeenCalled();
    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(payableAffiliate.pending_commission_cents).toBe(150000);
  });

  it('rejects invalid affiliate payout methods before creating payout records', async () => {
    const invalidAffiliate = {
      id: 'affiliate-invalid-payout-method',
      status: 'approved',
      pending_commission_cents: 150000,
      total_commission_earned_cents: 150000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: 'crypto',
    };
    const affiliateRepository = createRepository<any>([invalidAffiliate]);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).rejects.toThrow(
      'Payout method for affiliate affiliate-invalid-payout-method must be upi, bank_transfer, or paypal'
    );
    expect(payoutRepository.findOne).not.toHaveBeenCalled();
    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes affiliate payout methods before payout persistence', async () => {
    const affiliate = {
      id: 'affiliate-normalized-payout-method',
      status: 'approved',
      pending_commission_cents: 150000,
      total_commission_earned_cents: 150000,
      total_commission_paid_cents: 0,
      min_payout_cents: 100000,
      payout_method: ' BANK_TRANSFER ',
    };
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: createRepository<any>([affiliate]) as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-06')).resolves.toBe(1);
    expect(payoutRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      affiliate_id: 'affiliate-normalized-payout-method',
      seller_referrals_count: 0,
      seller_gmv_cents: 0,
      seller_commission_cents: 150000,
      customer_referrals_count: 0,
      customer_gmv_cents: 0,
      customer_commission_cents: 0,
      payout_method: 'bank_transfer',
    }));
    expect(payoutRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      payout_method: 'bank_transfer',
    }));
  });

  it('rejects malformed affiliate payout months before repository reads', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-payable',
        status: 'approved',
        pending_commission_cents: 150000,
        min_payout_cents: 100000,
        payout_method: 'upi',
      },
    ]);
    const payoutRepository = createRepository<any>();
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: payoutRepository as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.processMonthlyPayouts('2026-13')).rejects.toThrow(
      'Affiliate payout month must use YYYY-MM format'
    );
    await expect(service.processMonthlyPayouts('soon-ish')).rejects.toThrow(
      'Affiliate payout month must use YYYY-MM format'
    );

    expect(affiliateRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.findOne).not.toHaveBeenCalled();
    expect(payoutRepository.create).not.toHaveBeenCalled();
    expect(payoutRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes affiliate approval identifiers before status changes and marketing setup', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-1',
        status: ' pending ',
        affiliate_code: 'BLOGGER',
        rejection_reason: 'stale rejection marker',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    const affiliate = await service.approveAffiliate(' affiliate-1 ', ' admin-1 ', {
      seller_commission_rate: 6.5,
      customer_commission_rate: 2.5,
    });

    expect(affiliateRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'affiliate-1' },
    });
    expect(affiliate).toMatchObject({
      id: 'affiliate-1',
      status: 'approved',
      approved_by_id: 'admin-1',
      rejection_reason: null,
      seller_commission_rate: 6.5,
      customer_commission_rate: 2.5,
      social_media_templates: [
        'https://cdn.menumaker.app/templates/affiliate-instagram-story.png',
        'https://cdn.menumaker.app/templates/affiliate-post.png',
      ],
    });
    expect(affiliate.approved_at).toBeInstanceOf(Date);
    expect(JSON.parse(Buffer.from(affiliate.qr_code_data, 'base64url').toString('utf8'))).toMatchObject({
      type: 'affiliate_referral',
      affiliate_id: 'affiliate-1',
      code: 'BLOGGER',
      destination: 'https://menumaker.app/ref/BLOGGER',
    });
    expect(affiliateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        approved_by_id: 'admin-1',
        rejection_reason: null,
      })
    );
  });

  it('rejects malformed affiliate approval identifiers before repository reads', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-1',
        status: 'pending',
        affiliate_code: 'BLOGGER',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(service.approveAffiliate('   ', 'admin-1')).rejects.toThrow(
      'Affiliate id must be a non-empty string'
    );
    await expect(service.approveAffiliate('affiliate-1', '   ')).rejects.toThrow(
      'Affiliate approved_by_id must be a non-empty string'
    );
    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt or non-pending affiliate approval statuses before saving approval state', async () => {
    const corruptAffiliate = {
      id: 'affiliate-corrupt',
      status: 'mystery',
      affiliate_code: 'CORRUPT',
    };
    const approvedAffiliate = {
      id: 'affiliate-approved',
      status: 'approved',
      affiliate_code: 'APPROVED',
    };
    const affiliateRepository = createRepository<any>([corruptAffiliate, approvedAffiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-corrupt', 'admin-1')
    ).rejects.toThrow('Affiliate affiliate-corrupt status must be pending, approved, rejected, or suspended');
    await expect(
      service.approveAffiliate('affiliate-approved', 'admin-1')
    ).rejects.toThrow('Affiliate must be pending before approval');
    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(corruptAffiliate.status).toBe('mystery');
    expect(approvedAffiliate.status).toBe('approved');
  });

  it('rejects corrupt affiliate approval source rows before saving approval state', async () => {
    const providerFieldAffiliate = {
      id: 'affiliate-provider-approval-source',
      status: 'pending',
      affiliate_code: 'BLOGGER',
      provider_trace_id: 'trace-123',
    };
    const staleTimestampAffiliate = {
      id: 'affiliate-stale-approval-source',
      status: 'pending',
      affiliate_code: 'STALE',
      created_at: new Date('2026-06-30T00:00:00.000Z'),
      updated_at: new Date('2026-06-29T23:59:59.000Z'),
    };
    const staleApprovedAtAffiliate = {
      id: 'affiliate-stale-approved-at-source',
      status: 'pending',
      affiliate_code: 'STALEAPPROVED',
      created_at: new Date('2026-06-30T00:00:00.000Z'),
      approved_at: new Date('2026-06-29T23:59:59.000Z'),
    };
    const pendingApprovedAtAffiliate = {
      id: 'affiliate-pending-approved-at-source',
      status: 'pending',
      affiliate_code: 'PENDINGAPPROVED',
      created_at: new Date('2026-06-30T00:00:00.000Z'),
      approved_at: new Date('2026-06-30T00:05:00.000Z'),
      updated_at: new Date('2026-06-30T00:05:00.000Z'),
    };
    const staleUpdatedAfterApprovalAffiliate = {
      id: 'affiliate-stale-updated-after-approval-source',
      status: 'approved',
      affiliate_code: 'STALEUPDATED',
      created_at: new Date('2026-06-30T00:00:00.000Z'),
      approved_at: new Date('2026-06-30T00:05:00.000Z'),
      updated_at: new Date('2026-06-30T00:04:59.999Z'),
    };
    const affiliateRepository = createRepository<any>([
      providerFieldAffiliate,
      staleTimestampAffiliate,
      staleApprovedAtAffiliate,
      pendingApprovedAtAffiliate,
      staleUpdatedAfterApprovalAffiliate,
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-provider-approval-source', 'admin-1')
    ).rejects.toThrow(
      'Affiliate approval source affiliate-provider-approval-source include unsupported field(s): provider_trace_id'
    );

    await expect(
      service.approveAffiliate('affiliate-stale-approval-source', 'admin-1')
    ).rejects.toThrow(
      'Affiliate approval source affiliate-stale-approval-source updated_at cannot be before created_at'
    );

    await expect(
      service.approveAffiliate('affiliate-stale-approved-at-source', 'admin-1')
    ).rejects.toThrow(
      'Affiliate approval source affiliate-stale-approved-at-source approved_at cannot be before created_at'
    );

    await expect(
      service.approveAffiliate('affiliate-pending-approved-at-source', 'admin-1')
    ).rejects.toThrow(
      'Affiliate approval source affiliate-pending-approved-at-source approved_at cannot be present before approved or suspended status'
    );

    await expect(
      service.approveAffiliate('affiliate-stale-updated-after-approval-source', 'admin-1')
    ).rejects.toThrow(
      'Affiliate approval source affiliate-stale-updated-after-approval-source updated_at cannot be before approved_at'
    );

    expect(providerFieldAffiliate.status).toBe('pending');
    expect(staleTimestampAffiliate.status).toBe('pending');
    expect(staleApprovedAtAffiliate.status).toBe('pending');
    expect(pendingApprovedAtAffiliate.status).toBe('pending');
    expect(staleUpdatedAfterApprovalAffiliate.status).toBe('approved');
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed affiliate approval codes before generating public QR payloads', async () => {
    const unsafeAffiliate = {
      id: 'affiliate-unsafe-code',
      status: 'pending',
      affiliate_code: 'BLOGGER/../ADMIN',
    };
    const affiliateRepository = createRepository<any>([unsafeAffiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-unsafe-code', 'admin-1')
    ).rejects.toThrow(
      'Affiliate affiliate-unsafe-code affiliate_code must contain only uppercase letters, numbers, and underscores'
    );

    expect(unsafeAffiliate).toMatchObject({
      status: 'pending',
      affiliate_code: 'BLOGGER/../ADMIN',
    });
    expect(unsafeAffiliate.qr_code_data).toBeUndefined();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed affiliate approval QR payloads before saving approval state', async () => {
    const affiliate = {
      id: 'affiliate-unsafe-qr',
      status: 'pending',
      affiliate_code: 'BLOGGER',
    };
    const affiliateRepository = createRepository<any>([affiliate]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });
    jest.spyOn(service as any, 'buildAffiliateQrPayload').mockReturnValue(
      Buffer.from(JSON.stringify({
        type: 'affiliate_referral',
        affiliate_id: 'affiliate-unsafe-qr',
        code: 'BLOGGER',
        destination: 'https://menumaker.app/ref/BLOGGER',
        provider_trace_id: 'trace-123',
      })).toString('base64url')
    );

    await expect(
      service.approveAffiliate('affiliate-unsafe-qr', 'admin-1')
    ).rejects.toThrow('Affiliate QR payload includes unsupported field(s): provider_trace_id');

    expect(affiliate).toMatchObject({
      status: 'pending',
      affiliate_code: 'BLOGGER',
    });

    jest.spyOn(service as any, 'buildAffiliateQrPayload').mockReturnValue(
      Buffer.from(JSON.stringify({
        type: 'affiliate_referral',
        affiliate_id: 'affiliate-unsafe-qr',
        code: 'BLOGGER',
        destination: 'https://menumaker.app/ref/BLOGGER',
        'provider_trace_id\uFEFF': 'trace-123',
      })).toString('base64url')
    );

    await expect(
      service.approveAffiliate('affiliate-unsafe-qr', 'admin-1')
    ).rejects.toThrow('Affiliate QR payload field names must not include unsafe control characters');

    expect(affiliate).toMatchObject({
      status: 'pending',
      affiliate_code: 'BLOGGER',
    });
    expect(affiliate.qr_code_data).toBeUndefined();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cross-affiliate approval rows before saving approval state', async () => {
    const crossAffiliate = {
      id: 'affiliate-elsewhere',
      status: 'pending',
      affiliate_code: 'ELSEWHERE',
    };
    const affiliateRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => crossAffiliate),
    };
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-1', 'admin-1')
    ).rejects.toThrow('Persisted affiliate id must match requested affiliate');

    expect(affiliateRepository.save).not.toHaveBeenCalled();
    expect(crossAffiliate).toEqual({
      id: 'affiliate-elsewhere',
      status: 'pending',
      affiliate_code: 'ELSEWHERE',
    });
  });

  it('rejects invalid custom commission rates during affiliate approval', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-1',
        status: 'pending',
        affiliate_code: 'BLOGGER',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-1', 'admin-1', { seller_commission_rate: 101 })
    ).rejects.toThrow('Seller commission rate must be between 0 and 100');
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed affiliate approval custom-rate payloads before repository reads', async () => {
    const affiliateRepository = createRepository<any>([
      {
        id: 'affiliate-1',
        status: 'pending',
        affiliate_code: 'BLOGGER',
      },
    ]);
    const service = new AffiliateService({
      affiliateRepository: affiliateRepository as any,
      clickRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      userRepository: createRepository() as any,
      enforceCapability: false,
    });

    await expect(
      service.approveAffiliate('affiliate-1', 'admin-1', [] as any)
    ).rejects.toThrow('Affiliate approval custom rates must be an object');

    await expect(
      service.approveAffiliate('affiliate-1', 'admin-1', {
        seller_commission_rate: 10,
        provider_trace_id: 'trace-123',
      } as any)
    ).rejects.toThrow(
      'Affiliate approval custom rates include unsupported field(s): provider_trace_id'
    );

    await expect(
      service.approveAffiliate('affiliate-1', 'admin-1', {
        seller_commission_rate: 10,
        'provider_trace_id\uFEFF': 'trace-123',
      } as any)
    ).rejects.toThrow(
      'Affiliate approval custom rates field names must not include unsafe control characters'
    );

    expect(affiliateRepository.findOne).not.toHaveBeenCalled();
    expect(affiliateRepository.save).not.toHaveBeenCalled();
  });
});
