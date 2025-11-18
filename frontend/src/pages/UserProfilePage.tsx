import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { Upload, Save, Loader2, User, Lock } from 'lucide-react';

export default function UserProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: '',
    profile_photo_url: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const response = await api.getCurrentUser();
          if (response.success) {
            const userData = response.data.user;
            setProfileForm({
              name: userData.full_name || '',
              phone: userData.phone || '',
              address: userData.address || '',
              profile_photo_url: userData.profile_photo_url || '',
            });
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handlePhotoUpload = async (file: File) => {
    try {
      setUploadingPhoto(true);
      const response = await api.uploadImage(file);

      if (response.success) {
        const imageUrl = response.data.url;
        setProfileForm((prev) => ({ ...prev, profile_photo_url: imageUrl }));

        // Update profile photo on server
        await api.updateProfilePhoto(imageUrl);
        setSuccessMessage('Profile photo updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to upload photo');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
      });

      if (response.success) {
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to update profile');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New passwords do not match');
      setIsSaving(false);
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters');
      setIsSaving(false);
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    try {
      const response = await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      if (response.success) {
        setSuccessMessage('Password changed successfully');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to change password');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 mt-1">Manage your personal information and security</p>
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
            <User className="w-5 h-5 inline-block mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'password'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Lock className="w-5 h-5 inline-block mr-2" />
            Password
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Profile Photo */}
            <div>
              <label className="label">Profile Photo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300">
                  {profileForm.profile_photo_url ? (
                    <img
                      src={profileForm.profile_photo_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                    }}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploadingPhoto}
                  />
                  <label
                    htmlFor="photo-upload"
                    className="btn-outline cursor-pointer inline-flex items-center gap-2"
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Photo
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={user?.email || ''}
                className="input bg-gray-100"
                disabled
              />
              <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label htmlFor="name" className="label">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="input"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="input"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="address" className="label">
                Address
              </label>
              <textarea
                id="address"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="input min-h-[80px]"
                placeholder="123 Main St, City, State 12345"
              />
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
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="card">
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label htmlFor="currentPassword" className="label">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                className="input"
                required
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                className="input"
                required
                placeholder="Enter new password"
                minLength={8}
              />
              <p className="text-sm text-gray-500 mt-1">
                Password must be at least 8 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="input"
                required
                placeholder="Confirm new password"
              />
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
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Change Password
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
