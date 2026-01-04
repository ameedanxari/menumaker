import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getUserSettings: vi.fn(),
    updateUserSettings: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getUserSettings: ReturnType<typeof vi.fn>;
  updateUserSettings: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useSettingsStore.setState({
    settings: null,
    isLoading: false,
    error: null,
  });
  localStorage.clear();
};

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('fetches settings', async () => {
    mockedApi.getUserSettings.mockResolvedValue({
      success: true,
      data: { settings: { id: 's1', user_id: 'u1', language: 'en', notifications_enabled: true } },
    } as any);

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().settings?.id).toBe('s1');
    expect(useSettingsStore.getState().isLoading).toBe(false);
  });

  it('captures fetch errors', async () => {
    mockedApi.getUserSettings.mockRejectedValue({
      response: { data: { error: { message: 'oops' } } },
    });

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().error).toBe('oops');
  });

  it('updates settings', async () => {
    mockedApi.updateUserSettings.mockResolvedValue({
      success: true,
      data: { settings: { id: 's1', user_id: 'u1', language: 'fr', notifications_enabled: false } },
    } as any);

    await useSettingsStore.getState().updateSettings({ language: 'fr' });

    expect(useSettingsStore.getState().settings?.language).toBe('fr');
    expect(useSettingsStore.getState().isLoading).toBe(false);
  });
});
