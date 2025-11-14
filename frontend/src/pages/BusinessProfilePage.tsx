import { useEffect, useState } from 'react';
import { useBusinessStore } from '../stores/businessStore';
import { api } from '../services/api';
import { Upload, Store, Settings, Save, Loader2 } from 'lucide-react';

export default function BusinessProfilePage() {
  const {
    currentBusiness,
    settings,
    fetchBusinesses,
    createBusiness,
    updateBusiness,
    updateSettings,
    isLoading,
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    banner_url: '',
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    delivery_enabled: false,
    pickup_enabled: true,
    delivery_fee_type: 'flat' as 'flat' | 'distance' | 'free',
    delivery_fee_flat_cents: 0,
    delivery_fee_per_km_cents: 0,
    delivery_radius_km: 10,
    minimum_order_cents: 0,
    currency: 'USD',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    if (currentBusiness) {
      setProfileForm({
        name: currentBusiness.name || '',
        description: currentBusiness.description || '',
        address: currentBusiness.address || '',
        phone: currentBusiness.phone || '',
        email: currentBusiness.email || '',
        logo_url: currentBusiness.logo_url || '',
        banner_url: currentBusiness.banner_url || '',
      });
    }
  }, [currentBusiness]);

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        delivery_enabled: settings.delivery_enabled,
        pickup_enabled: settings.pickup_enabled,
        delivery_fee_type: settings.delivery_fee_type,
        delivery_fee_flat_cents: settings.delivery_fee_flat_cents,
        delivery_fee_per_km_cents: settings.delivery_fee_per_km_cents,
        delivery_radius_km: settings.delivery_radius_km,
        minimum_order_cents: settings.minimum_order_cents,
        currency: settings.currency,
        timezone: settings.timezone,
      });
    }
  }, [settings]);

  const handleImageUpload = async (
    file: File,
    type: 'logo' | 'banner'
  ) => {
    try {
      if (type === 'logo') setUploadingLogo(true);
      else setUploadingBanner(true);

      const response = await api.uploadImage(file);

      if (response.success) {
        const imageUrl = response.data.url;
        setProfileForm((prev) => ({
          ...prev,
          [type === 'logo' ? 'logo_url' : 'banner_url']: imageUrl,
        }));
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to upload image');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (currentBusiness) {
        // Update existing business
        await updateBusiness(currentBusiness.id, profileForm);
        setSuccessMessage('Business profile updated successfully');
      } else {
        // Create new business
        await createBusiness({
          name: profileForm.name,
          description: profileForm.description,
          address: profileForm.address,
          phone: profileForm.phone,
          email: profileForm.email,
        });
        setSuccessMessage('Business created successfully');
      }

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to save business');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentBusiness) {
      setErrorMessage('Please create a business profile first');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await updateSettings(currentBusiness.id, settingsForm);
      setSuccessMessage('Settings updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !currentBusiness) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {currentBusiness ? 'Business Profile' : 'Create Your Business'}
        </h1>
        <p className="text-gray-600 mt-1">
          {currentBusiness
            ? 'Manage your business information and settings'
            : 'Set up your business to start creating menus'}
        </p>
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'profile'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Store className="w-5 h-5 inline-block mr-2" />
            Profile
          </button>
          {currentBusiness && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="w-5 h-5 inline-block mr-2" />
              Settings
            </button>
          )}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="label">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, name: e.target.value })
                }
                className="input"
                required
                placeholder="My Restaurant"
              />
            </div>

            <div>
              <label htmlFor="description" className="label">
                Description
              </label>
              <textarea
                id="description"
                value={profileForm.description}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, description: e.target.value })
                }
                className="input min-h-[100px]"
                placeholder="Tell customers about your business..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="label">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  className="input"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  className="input"
                  placeholder="contact@myrestaurant.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="label">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={profileForm.address}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, address: e.target.value })
                }
                className="input"
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            {currentBusiness && (
              <div className="space-y-4">
                <div>
                  <label className="label">Logo</label>
                  <div className="flex items-center gap-4">
                    {profileForm.logo_url && (
                      <img
                        src={profileForm.logo_url}
                        alt="Logo"
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'logo');
                        }}
                        className="hidden"
                        id="logo-upload"
                        disabled={uploadingLogo}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="btn-outline cursor-pointer inline-flex items-center gap-2"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload Logo
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">Banner Image</label>
                  <div className="space-y-4">
                    {profileForm.banner_url && (
                      <img
                        src={profileForm.banner_url}
                        alt="Banner"
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'banner');
                        }}
                        className="hidden"
                        id="banner-upload"
                        disabled={uploadingBanner}
                      />
                      <label
                        htmlFor="banner-upload"
                        className="btn-outline cursor-pointer inline-flex items-center gap-2"
                      >
                        {uploadingBanner ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload Banner
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    {currentBusiness ? 'Save Changes' : 'Create Business'}
                  </>
                )}
              </button>
            </div>
          </form>

          {currentBusiness && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Your menu URL:{' '}
                <a
                  href={`/${currentBusiness.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  {window.location.origin}/{currentBusiness.slug}
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && currentBusiness && (
        <div className="card">
          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Order Options</h3>

              <div className="flex items-center gap-3">
                <input
                  id="pickup_enabled"
                  type="checkbox"
                  checked={settingsForm.pickup_enabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, pickup_enabled: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="pickup_enabled" className="text-sm font-medium text-gray-700">
                  Enable Pickup
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="delivery_enabled"
                  type="checkbox"
                  checked={settingsForm.delivery_enabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, delivery_enabled: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="delivery_enabled" className="text-sm font-medium text-gray-700">
                  Enable Delivery
                </label>
              </div>
            </div>

            {settingsForm.delivery_enabled && (
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900">Delivery Settings</h3>

                <div>
                  <label htmlFor="delivery_fee_type" className="label">
                    Delivery Fee Type
                  </label>
                  <select
                    id="delivery_fee_type"
                    value={settingsForm.delivery_fee_type}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        delivery_fee_type: e.target.value as 'flat' | 'distance' | 'free',
                      })
                    }
                    className="input"
                  >
                    <option value="free">Free Delivery</option>
                    <option value="flat">Flat Fee</option>
                    <option value="distance">Distance-Based</option>
                  </select>
                </div>

                {settingsForm.delivery_fee_type === 'flat' && (
                  <div>
                    <label htmlFor="delivery_fee_flat" className="label">
                      Flat Delivery Fee ($)
                    </label>
                    <input
                      id="delivery_fee_flat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={(settingsForm.delivery_fee_flat_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          delivery_fee_flat_cents: Math.round(
                            parseFloat(e.target.value) * 100
                          ),
                        })
                      }
                      className="input"
                    />
                  </div>
                )}

                {settingsForm.delivery_fee_type === 'distance' && (
                  <div>
                    <label htmlFor="delivery_fee_per_km" className="label">
                      Fee Per Kilometer ($)
                    </label>
                    <input
                      id="delivery_fee_per_km"
                      type="number"
                      step="0.01"
                      min="0"
                      value={(settingsForm.delivery_fee_per_km_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          delivery_fee_per_km_cents: Math.round(
                            parseFloat(e.target.value) * 100
                          ),
                        })
                      }
                      className="input"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="delivery_radius" className="label">
                    Delivery Radius (km)
                  </label>
                  <input
                    id="delivery_radius"
                    type="number"
                    step="0.1"
                    min="0"
                    value={settingsForm.delivery_radius_km}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        delivery_radius_km: parseFloat(e.target.value),
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Settings</h3>

              <div>
                <label htmlFor="minimum_order" className="label">
                  Minimum Order Amount ($)
                </label>
                <input
                  id="minimum_order"
                  type="number"
                  step="0.01"
                  min="0"
                  value={(settingsForm.minimum_order_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      minimum_order_cents: Math.round(
                        parseFloat(e.target.value) * 100
                      ),
                    })
                  }
                  className="input"
                />
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
      )}
    </div>
  );
}
