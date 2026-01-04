import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { api } from '../services/api';

vi.mock('../services/api', () => {
  return {
    api: {
      login: vi.fn(),
      signup: vi.fn(),
      getCurrentUser: vi.fn(),
      setAccessToken: vi.fn(),
    },
  };
});

const mockedApi = api as unknown as {
  login: ReturnType<typeof vi.fn>;
  signup: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  setAccessToken: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
  localStorage.clear();
};

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('logs in and stores token/user', async () => {
    mockedApi.login.mockResolvedValue({
      success: true,
      data: {
        user: { id: 'u1', email: 'test@example.com', created_at: 'now' },
        tokens: { accessToken: 'token-123' },
      },
    });

    await useAuthStore.getState().login('test@example.com', 'pass');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('u1');
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('token-123');
    expect(state.isLoading).toBe(false);
  });

  it('clears state on logout', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@example.com', created_at: 'now' },
      accessToken: 'token',
      isAuthenticated: true,
      isLoading: false,
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith(null);
  });

  it('initAuth hydrates when token is present', async () => {
    useAuthStore.setState({
      user: null,
      accessToken: 'token',
      isAuthenticated: false,
      isLoading: false,
    });
    mockedApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: { id: 'u2', email: 'me@example.com', created_at: 'now' } },
    });

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('token');
    expect(state.user?.id).toBe('u2');
    expect(state.isAuthenticated).toBe(true);
  });

  it('surface errors on failed login and stops loading', async () => {
    mockedApi.login.mockRejectedValue(new Error('invalid'));

    await expect(useAuthStore.getState().login('bad', 'creds')).rejects.toThrow();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
