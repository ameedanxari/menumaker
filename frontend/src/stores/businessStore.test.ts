import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBusinessStore } from './businessStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getBusinesses: vi.fn(),
    createBusiness: vi.fn(),
    updateBusiness: vi.fn(),
    updateBusinessSettings: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getBusinesses: ReturnType<typeof vi.fn>;
  createBusiness: ReturnType<typeof vi.fn>;
  updateBusiness: ReturnType<typeof vi.fn>;
  updateBusinessSettings: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useBusinessStore.setState({
    currentBusiness: null,
    businesses: [],
    settings: null,
    isLoading: false,
    error: null,
  });
};

describe('businessStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('loads businesses and sets current/settings', async () => {
    mockedApi.getBusinesses.mockResolvedValue({
      success: true,
      data: {
        businesses: [
          {
            id: 'b1',
            owner_id: 'u1',
            name: 'Biz',
            slug: 'biz',
            is_active: true,
            created_at: '',
            updated_at: '',
            settings: { id: 's1', business_id: 'b1' },
          },
        ],
      },
    } as any);

    await useBusinessStore.getState().fetchBusinesses();

    const state = useBusinessStore.getState();
    expect(state.currentBusiness?.id).toBe('b1');
    expect(state.settings?.id).toBe('s1');
    expect(state.isLoading).toBe(false);
  });

  it('captures fetch errors', async () => {
    mockedApi.getBusinesses.mockRejectedValue({
      response: { data: { error: { message: 'fail' } } },
    });

    await useBusinessStore.getState().fetchBusinesses();

    expect(useBusinessStore.getState().error).toBe('fail');
  });

  it('creates business and sets as current', async () => {
    mockedApi.createBusiness.mockResolvedValue({
      success: true,
      data: {
        business: {
          id: 'b2',
          owner_id: 'u1',
          name: 'New Biz',
          slug: 'new-biz',
          is_active: true,
          created_at: '',
          updated_at: '',
          settings: { id: 's2', business_id: 'b2' },
        },
      },
    } as any);

    const created = await useBusinessStore.getState().createBusiness({ name: 'New Biz' });

    expect(created.id).toBe('b2');
    expect(useBusinessStore.getState().currentBusiness?.id).toBe('b2');
    expect(useBusinessStore.getState().settings?.id).toBe('s2');
  });

  it('updates settings and clears loading', async () => {
    mockedApi.updateBusinessSettings.mockResolvedValue({
      success: true,
      data: { settings: { id: 's3', business_id: 'b1', currency: 'USD' } },
    } as any);

    await useBusinessStore.getState().updateSettings('b1', { currency: 'USD' });

    expect(useBusinessStore.getState().settings?.currency).toBe('USD');
    expect(useBusinessStore.getState().isLoading).toBe(false);
  });
});
