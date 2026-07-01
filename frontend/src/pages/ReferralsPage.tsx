import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ReferralStats {
  total_referrals: number;
  total_clicks: number;
  total_signups: number;
  total_published: number;
  total_rewards_earned_cents: number;
  conversion_rate: number;
}

interface ReferralCode {
  referral_code: string;
  referral_link: string;
  share_message: string;
}

const UNSAFE_REFERRAL_PAGE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const REFERRAL_CONVERSION_RATE_TOLERANCE = 0.0001;

function safeReferralPageText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || UNSAFE_REFERRAL_PAGE_TEXT_CONTROLS.test(normalized)) return null;
  return normalized;
}

function safeReferralLink(value: unknown): string | null {
  const normalized = safeReferralPageText(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeReferralCodePayload(rawCode: ReferralCode | null): ReferralCode | null {
  if (!rawCode) return null;
  const referral_code = safeReferralPageText(rawCode.referral_code);
  const referral_link = safeReferralLink(rawCode.referral_link);
  const share_message = safeReferralPageText(rawCode.share_message);
  if (!referral_code || !referral_link || !share_message) return null;
  return { referral_code, referral_link, share_message };
}

function safeReferralCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function safeReferralConversionRate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

export function sanitizeReferralStats(rawStats: ReferralStats | null): ReferralStats | null {
  if (!rawStats) return null;
  const total_referrals = safeReferralCount(rawStats.total_referrals);
  const total_clicks = safeReferralCount(rawStats.total_clicks);
  const total_signups = safeReferralCount(rawStats.total_signups);
  const total_published = safeReferralCount(rawStats.total_published);
  const conversion_rate = safeReferralConversionRate(rawStats.conversion_rate);

  if (
    total_referrals === null ||
    total_clicks === null ||
    total_signups === null ||
    total_published === null ||
    conversion_rate === null
  ) {
    return null;
  }

  if (total_signups > total_referrals || total_signups > total_clicks || total_published > total_signups) {
    return null;
  }

  if ((total_clicks === 0 || total_signups === 0) && conversion_rate !== 0) {
    return null;
  }

  if (
    total_clicks > 0 &&
    Math.abs(conversion_rate - total_signups / total_clicks) > REFERRAL_CONVERSION_RATE_TOLERANCE
  ) {
    return null;
  }

  return {
    total_referrals,
    total_clicks,
    total_signups,
    total_published,
    total_rewards_earned_cents: 0,
    conversion_rate,
  };
}

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [codeRes, statsRes] = await Promise.all([
        api.getMyReferralCode(),
        api.getMyReferralStats(),
      ]);

      const codePayload = codeRes as { data?: ReferralCode };
      const statsPayload = statsRes as { data?: ReferralStats };
      setReferralCode(sanitizeReferralCodePayload(codePayload.data ?? null));
      setStats(sanitizeReferralStats(statsPayload.data ?? null));
    } catch (_error) {
      console.error('Failed to load referral data:', _error);
      setReferralCode(null);
      setStats(null);
      setLoadError('Referral information is unavailable right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode?.referral_link) {
      navigator.clipboard.writeText(referralCode.referral_link);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    if (referralCode?.share_message) {
      window.open(`https://wa.me/?text=${encodeURIComponent(referralCode.share_message)}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading referral data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
          Referral Program
        </h1>
        <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
          Share your seller referral code. Enhanced rewards, leaderboards, affiliate campaigns, and prize payouts are launch-gated.
        </p>
      </div>

      {loadError ? (
        <div className="text-center py-16 bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary mb-4">
            Referral code unavailable
          </h2>
          <p className="text-neutral-600 dark:text-dark-text-secondary mb-8 max-w-md mx-auto">
            {loadError}
          </p>
          <button
            onClick={loadData}
            className="px-8 py-3 rounded-md transition-colors font-semibold text-lg bg-primary-500 text-white hover:bg-primary-600"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Total Referrals
              </p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-dark-text-primary">
                {stats?.total_referrals ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Signups
              </p>
              <p className="text-3xl font-bold text-success-600">
                {stats?.total_signups ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Menus Published
              </p>
              <p className="text-3xl font-bold text-primary-500">
                {stats?.total_published ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Enhanced Rewards
              </p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-dark-text-primary">
                Disabled
              </p>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-8 mb-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Your Referral Code</h2>
            <div className="flex items-center gap-4 mb-6">
              <code className="flex-1 text-2xl font-mono font-bold bg-white bg-opacity-20 rounded-md px-6 py-4">
                {referralCode?.referral_code ?? 'Unavailable'}
              </code>
              <button
                onClick={handleCopyCode}
                disabled={!referralCode?.referral_link}
                className="px-6 py-4 bg-white text-primary-500 rounded-md hover:bg-opacity-90 transition-colors font-semibold"
              >
                {copiedCode ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleShareWhatsApp}
                disabled={!referralCode?.share_message}
                className="flex-1 px-6 py-3 bg-white bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors font-semibold"
              >
                📱 Share on WhatsApp
              </button>
              <button
                disabled
                className="flex-1 px-6 py-3 bg-white bg-opacity-10 rounded-md cursor-not-allowed font-semibold text-white text-opacity-80"
                aria-describedby="instagram-share-disabled"
              >
                📸 Instagram disabled
              </button>
            </div>
            <p id="instagram-share-disabled" className="mt-3 text-sm text-white text-opacity-80">
              Instagram sharing is not enabled in this launch build; copy the link or use WhatsApp instead.
            </p>
          </div>

          {/* How it Works */}
          <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-8 mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary mb-6">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  1️⃣
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                  Share Your Code
                </h3>
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                  Share your unique referral code with friends using the link or message above
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  2️⃣
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                  Friend Joins
                </h3>
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                  Your friend signs up using your referral code and publishes their first menu
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  3️⃣
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                  Earn Rewards
                </h3>
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                  Referral reward credits and prize campaigns remain disabled until the enhanced-referral launch evidence is complete
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-amber-200 dark:border-dark-border-default overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-dark-border-default">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary">
            Enhanced Referral Campaigns
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
            Leaderboards, affiliate campaigns, and prize payouts are disabled in the capability registry and are not advertised as available in this launch build.
          </p>
        </div>
        <div className="p-8 text-center text-neutral-600 dark:text-dark-text-secondary">
          Basic referral-code sharing may remain visible. Enhanced reward credits, ranked competitions, and affiliate payouts require a separate enablement decision.
        </div>
      </div>
    </div>
  );
}
