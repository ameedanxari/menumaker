import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ReferralStats {
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_earnings_cents: number;
  referral_code: string;
  leaderboard_position: number | null;
}

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
  successful_referrals: number;
  prize_amount: number | null;
}

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, leaderboardRes] = await Promise.all([
        api.get('/customers/referrals/stats').catch(() => ({ data: { data: { stats: null } } })),
        api.get('/referrals/leaderboard').catch(() => ({ data: { data: { leaderboard: [] } } })),
      ]);

      setStats(statsRes.data.data.stats || null);
      setLeaderboard(leaderboardRes.data.data.leaderboard || []);
    } catch (_error) {
      console.error('Failed to load referral data:', _error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReferralCode = async () => {
    try {
      await api.post('/customers/referrals/create', {
        business_id: 'your-business-id', // This would come from auth context
      });
      loadData();
      alert('Referral code created successfully!');
    } catch (_error) {
      console.error('Failed to create referral code:', _error);
      alert('Failed to create referral code');
    }
  };

  const handleCopyCode = () => {
    if (stats?.referral_code) {
      navigator.clipboard.writeText(`https://menumaker.app?ref=${stats.referral_code}`);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    if (stats?.referral_code) {
      const message = `🍽️ Join me on MenuMaker! Use my referral code ${stats.referral_code} and get ₹100 off your first order: https://menumaker.app?ref=${stats.referral_code}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toFixed(2)}`;
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
          Earn rewards by referring friends and climb the leaderboard
        </p>
      </div>

      {!stats ? (
        <div className="text-center py-16 bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary mb-4">
            Start Earning with Referrals
          </h2>
          <p className="text-neutral-600 dark:text-dark-text-secondary mb-8 max-w-md mx-auto">
            Create your referral code and earn ₹100 for every friend who joins MenuMaker!
          </p>
          <button
            onClick={handleCreateReferralCode}
            className="px-8 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold text-lg"
          >
            Create Referral Code
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
                {stats.total_referrals}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Successful Referrals
              </p>
              <p className="text-3xl font-bold text-success-600">
                {stats.successful_referrals}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Total Earnings
              </p>
              <p className="text-3xl font-bold text-primary-500">
                {formatCurrency(stats.total_earnings_cents)}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
                Leaderboard Rank
              </p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-dark-text-primary">
                {stats.leaderboard_position ? `#${stats.leaderboard_position}` : '—'}
              </p>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-8 mb-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Your Referral Code</h2>
            <div className="flex items-center gap-4 mb-6">
              <code className="flex-1 text-2xl font-mono font-bold bg-white bg-opacity-20 rounded-md px-6 py-4">
                {stats.referral_code}
              </code>
              <button
                onClick={handleCopyCode}
                className="px-6 py-4 bg-white text-primary-500 rounded-md hover:bg-opacity-90 transition-colors font-semibold"
              >
                {copiedCode ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 px-6 py-3 bg-white bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors font-semibold"
              >
                📱 Share on WhatsApp
              </button>
              <button
                onClick={() => {
                  /* Share on Instagram */
                }}
                className="flex-1 px-6 py-3 bg-white bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors font-semibold"
              >
                📸 Share on Instagram
              </button>
            </div>
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
                  Share your unique referral code with friends via WhatsApp, Instagram, or any social media
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
                  Both you and your friend get ₹100 credit! Plus, climb the leaderboard to win monthly prizes
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Leaderboard */}
      <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-dark-border-default">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary">
            🏆 Leaderboard
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
            Top referrers this month • Prizes: ₹5,000 (1st), ₹3,000 (2nd), ₹2,000 (3rd)
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-neutral-600 dark:text-dark-text-secondary">
            No entries yet. Be the first to start referring!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase">
                  Successful Referrals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase">
                  Prize
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-dark-border-default">
              {leaderboard.map((entry) => (
                <tr key={entry.user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <td className="px-6 py-4">
                    <span
                      className={`text-xl font-bold ${
                        entry.rank <= 3 ? 'text-primary-500' : 'text-neutral-600'
                      }`}
                    >
                      {entry.rank === 1 && '🥇'}
                      {entry.rank === 2 && '🥈'}
                      {entry.rank === 3 && '🥉'}
                      {entry.rank > 3 && `#${entry.rank}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {entry.user.avatar ? (
                        <img
                          src={entry.user.avatar}
                          alt={entry.user.name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-200 font-semibold">
                          {entry.user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                        {entry.user.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-neutral-900 dark:text-dark-text-primary font-semibold">
                    {entry.successful_referrals}
                  </td>
                  <td className="px-6 py-4">
                    {entry.prize_amount ? (
                      <span className="text-success-600 font-bold">
                        {formatCurrency(entry.prize_amount * 100)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
