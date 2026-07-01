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
      logout: vi.fn(),
    },
  };
});

const mockedApi = api as unknown as {
  login: ReturnType<typeof vi.fn>;
  signup: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  setAccessToken: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
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

  it('logs in and keeps access token memory scoped', async () => {
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
    expect(state.accessToken).toBe('token-123');
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('token-123');
    expect(state.isLoading).toBe(false);
    const persisted = JSON.stringify(localStorage);
    expect(persisted).not.toContain('token-123');
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
    expect(mockedApi.logout).toHaveBeenCalled();
  });

  it('initAuth hydrates identity through cookie-backed /auth/me without persisted bearer token', async () => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockedApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: { id: 'u2', email: 'me@example.com', created_at: 'now' } },
    });

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(mockedApi.setAccessToken).not.toHaveBeenCalledWith('token');
    expect(state.user?.id).toBe('u2');
    expect(state.isAuthenticated).toBe(true);
  });

  it('does not persist access or refresh tokens after login and reload', async () => {
    mockedApi.login.mockResolvedValue({
      success: true,
      data: {
        user: { id: 'u3', email: 'reload@example.com', created_at: 'now' },
        tokens: { accessToken: 'jwt.header.payload', refreshToken: 'native-only-refresh' },
      },
    });

    await useAuthStore.getState().login('reload@example.com', 'pass');

    const persisted = localStorage.getItem('auth-storage') ?? '';
    expect(persisted).not.toContain('jwt.header.payload');
    expect(persisted).not.toContain('native-only-refresh');
    expect(persisted).not.toMatch(/accessToken|refreshToken|session/i);
  });

  it('surface errors on failed login and stops loading', async () => {
    mockedApi.login.mockRejectedValue(new Error('invalid'));

    await expect(useAuthStore.getState().login('bad', 'creds')).rejects.toThrow();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
