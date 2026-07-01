import { describe, expect, it } from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshJwt,
  getTokenConfig,
  hashCredential,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/utils/jwt';

const payload = { userId: 'user-1', email: 'jwt@example.com' };

describe('typed JWT helpers', () => {
  it('separates access and refresh token type/audience/keys', () => {
    const accessToken = generateAccessToken(payload, { sid: 'sid-1', jti: 'access-jti' });
    const refreshToken = generateRefreshJwt(payload, { sid: 'sid-1', familyId: 'family-1', jti: 'refresh-jti' });

    expect(verifyAccessToken(accessToken)).toMatchObject({ typ: 'access', aud: 'menumaker-access', sid: 'sid-1' });
    expect(verifyRefreshToken(refreshToken)).toMatchObject({ typ: 'refresh', aud: 'menumaker-refresh', sid: 'sid-1' });
    expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid or expired access token');
  });

  it('rejects weak or shared token configuration', () => {
    expect(() => getTokenConfig({ JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'another-short' })).toThrow('at least 32');
    expect(() => getTokenConfig({
      JWT_SECRET: 'same-secret-value-with-more-than-32-characters',
      JWT_REFRESH_SECRET: 'same-secret-value-with-more-than-32-characters',
    })).toThrow('distinct');
  });

  it('hashes credentials without exposing token contents', () => {
    const hash = hashCredential('raw-refresh-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('raw-refresh-token');
  });
});
