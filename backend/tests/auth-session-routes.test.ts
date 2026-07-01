import { describe, expect, it } from '@jest/globals';
import {
  csrfFromRefresh,
  expireRefreshCookie,
  isNativeClient,
  refreshCookie,
  sessionTokensForClient,
  setRefreshCookie,
} from '../src/routes/auth';

describe('auth session route helpers', () => {
  it('sets HttpOnly Strict refresh cookies and a separate CSRF cookie', () => {
    const headers: Record<string, string | string[]> = {};
    setRefreshCookie({ header: (name, value) => { headers[name] = value; } }, 'opaque-refresh');
    const cookies = headers['set-cookie'] as string[];
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Strict');
    expect(cookies[0]).not.toContain('Bearer');
    expect(cookies[1]).toContain(`menumaker_csrf=${csrfFromRefresh('opaque-refresh')}`);
  });

  it('returns refresh credentials only for explicit native clients', () => {
    const session = { accessToken: 'access', refreshToken: 'refresh', session: {} } as any;
    expect(isNativeClient({ headers: { 'x-client-platform': 'android' } })).toBe(true);
    expect(sessionTokensForClient(session, true)).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(sessionTokensForClient(session, false)).toEqual({ accessToken: 'access' });
  });

  it('extracts and expires refresh cookies for logout', () => {
    expect(refreshCookie('a=1; __Host-menumaker_refresh=abc%20123; b=2')).toBe('abc%20123');
    const headers: Record<string, string | string[]> = {};
    expireRefreshCookie({ header: (name, value) => { headers[name] = value; } });
    expect(JSON.stringify(headers)).toContain('Max-Age=0');
  });
});
