import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Save, Loader2, Globe, Bell, Moon, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { settings, fetchSettings, updateSettings, isLoading } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({
    language: 'en',
    notifications_enabled: true,
    order_notifications: true,
    promotion_notifications: true,
    review_notifications: true,
    biometric_enabled: false,
    theme: 'system',
  });

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setForm({
        language: settings.language || 'en',
        notifications_enabled: settings.notifications_enabled ?? true,
        order_notifications: settings.order_notifications ?? true,
        promotion_notifications: settings.promotion_notifications ?? true,
        review_notifications: settings.review_notifications ?? true,
        biometric_enabled: settings.biometric_enabled ?? false,
        theme: settings.theme || 'system',
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await updateSettings(form);
      setSuccessMessage('Settings updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to update settings');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your preferences and application settings</p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Language Settings */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Language</h3>
            </div>
            <div>
              <label htmlFor="language" className="label">
                Preferred Language
              </label>
              <select
                id="language"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input"
              >
                <option value="en">English</option>
                <option value="ar">Arabic (العربية)</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="ur">Urdu (اردو)</option>
                <option value="hi">Hindi (हिन्दी)</option>
              </select>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="notifications_enabled"
                    type="checkbox"
                    checked={form.notifications_enabled}
                    onChange={(e) =>
                      setForm({ ...form, notifications_enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="notifications_enabled" className="font-medium text-gray-700">
                    Enable Notifications
                  </label>
                  <p className="text-sm text-gray-500">
                    Receive notifications about your account and orders
                  </p>
                </div>
              </div>

              {form.notifications_enabled && (
                <>
                  <div className="flex items-start ml-7">
                    <div className="flex items-center h-5">
                      <input
                        id="order_notifications"
                        type="checkbox"
                        checked={form.order_notifications}
                        onChange={(e) =>
                          setForm({ ...form, order_notifications: e.target.checked })
                        }
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="order_notifications" className="font-medium text-gray-700">
                        Order Updates
                      </label>
                      <p className="text-sm text-gray-500">
                        Get notified about order status changes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start ml-7">
                    <div className="flex items-center h-5">
                      <input
                        id="promotion_notifications"
                        type="checkbox"
                        checked={form.promotion_notifications}
                        onChange={(e) =>
                          setForm({ ...form, promotion_notifications: e.target.checked })
                        }
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="promotion_notifications" className="font-medium text-gray-700">
                        Promotions & Offers
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive updates about special offers and promotions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start ml-7">
                    <div className="flex items-center h-5">
                      <input
                        id="review_notifications"
                        type="checkbox"
                        checked={form.review_notifications}
                        onChange={(e) =>
                          setForm({ ...form, review_notifications: e.target.checked })
                        }
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="review_notifications" className="font-medium text-gray-700">
                        Review Reminders
                      </label>
                      <p className="text-sm text-gray-500">
                        Get reminded to review your orders
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Moon className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Appearance</h3>
            </div>
            <div>
              <label htmlFor="theme" className="label">
                Theme
              </label>
              <select
                id="theme"
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                className="input"
              >
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Choose your preferred color scheme
              </p>
            </div>
          </div>

          {/* Security Settings */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="biometric_enabled"
                  type="checkbox"
                  checked={form.biometric_enabled}
                  onChange={(e) => setForm({ ...form, biometric_enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="biometric_enabled" className="font-medium text-gray-700">
                  Enable Biometric Authentication
                </label>
                <p className="text-sm text-gray-500">
                  Use fingerprint or face recognition for secure login
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
