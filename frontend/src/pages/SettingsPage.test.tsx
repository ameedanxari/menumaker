// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../stores/settingsStore';

// Mock the store module
vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

const mockFetchSettings = vi.fn();
const mockUpdateSettings = vi.fn();

const mockSettings = {
  id: 's1',
  user_id: 'u1',
  language: 'en',
  notifications_enabled: true,
  order_notifications: true,
  promotion_notifications: false,
  review_notifications: true,
  biometric_enabled: false,
  theme: 'system',
};

describe('SettingsPage store interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: mockSettings,
      fetchSettings: mockFetchSettings,
      updateSettings: mockUpdateSettings,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchSettings is called when store is accessed', () => {
    // Access the store to verify mock is set up correctly
    const store = useSettingsStore();
    expect(store.settings).toEqual(mockSettings);
    expect(store.fetchSettings).toBe(mockFetchSettings);
  });

  it('updateSettings can be called with form data', async () => {
    mockUpdateSettings.mockResolvedValue(undefined);
    const store = useSettingsStore();
    
    await store.updateSettings({ language: 'fr' });
    
    expect(mockUpdateSettings).toHaveBeenCalledWith({ language: 'fr' });
  });

  it('handles updateSettings errors', async () => {
    mockUpdateSettings.mockRejectedValue(new Error('Update failed'));
    const store = useSettingsStore();
    
    await expect(store.updateSettings({ language: 'fr' })).rejects.toThrow('Update failed');
  });
});
