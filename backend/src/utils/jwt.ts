import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  businessId?: string;
}

export interface AccessTokenPayload extends JWTPayload {
  typ: 'access';
  jti: string;
  sid?: string;
  iss: string;
  aud: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  typ: 'refresh';
  jti: string;
  sid: string;
  iss: string;
  aud: string;
  familyId?: string;
}

export interface TokenConfig {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  accessAudience: string;
  refreshAudience: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

const MIN_SECRET_LENGTH = 32;

export function getTokenConfig(env: NodeJS.ProcessEnv = process.env): TokenConfig {
  const accessSecret = env.JWT_ACCESS_SECRET ?? env.JWT_SECRET;
  const refreshSecret = env.JWT_REFRESH_SECRET
    ?? (env.NODE_ENV === 'test' ? 'test-refresh-secret-for-ci-testing-32-chars-minimum' : undefined);

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT access and refresh secrets are required');
  }
  if (accessSecret.length < MIN_SECRET_LENGTH || refreshSecret.length < MIN_SECRET_LENGTH) {
    throw new Error('JWT access and refresh secrets must be at least 32 characters long');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT access and refresh secrets must be distinct');
  }

  return {
    accessSecret,
    refreshSecret,
    issuer: env.JWT_ISSUER ?? 'menumaker-api',
    accessAudience: env.JWT_ACCESS_AUDIENCE ?? 'menumaker-access',
    refreshAudience: env.JWT_REFRESH_AUDIENCE ?? 'menumaker-refresh',
    accessExpiresIn: env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  };
}

export function generateAccessToken(payload: JWTPayload, options: { sid?: string; jti?: string } = {}): string {
  const config = getTokenConfig();
  const claims: AccessTokenPayload = {
    ...payload,
    typ: 'access',
    jti: options.jti ?? crypto.randomUUID(),
    sid: options.sid,
  } as AccessTokenPayload;
  return jwt.sign(claims, config.accessSecret, {
    expiresIn: config.accessExpiresIn,
    issuer: config.issuer,
    audience: config.accessAudience,
  } as jwt.SignOptions);
}

export function generateRefreshJwt(payload: JWTPayload, options: { sid: string; familyId?: string; jti?: string }): string {
  const config = getTokenConfig();
  const claims: RefreshTokenPayload = {
    ...payload,
    typ: 'refresh',
    jti: options.jti ?? crypto.randomUUID(),
    sid: options.sid,
    familyId: options.familyId,
  } as RefreshTokenPayload;
  return jwt.sign(claims, config.refreshSecret, {
    expiresIn: config.refreshExpiresIn,
    issuer: config.issuer,
    audience: config.refreshAudience,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: JWTPayload): string {
  return generateRefreshJwt(payload, { sid: crypto.randomUUID(), familyId: crypto.randomUUID() });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getTokenConfig();
  try {
    const payload = jwt.verify(token, config.accessSecret, {
      issuer: config.issuer,
      audience: config.accessAudience,
    }) as AccessTokenPayload;
    if (payload.typ !== 'access') throw new Error('Wrong token type');
    return payload;
  } catch {
    throw new Error('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const config = getTokenConfig();
  try {
    const payload = jwt.verify(token, config.refreshSecret, {
      issuer: config.issuer,
      audience: config.refreshAudience,
    }) as RefreshTokenPayload;
    if (payload.typ !== 'refresh') throw new Error('Wrong token type');
    return payload;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
}

export function verifyToken(token: string): JWTPayload {
  return verifyAccessToken(token);
}

export function hashCredential(value: string, env: NodeJS.ProcessEnv = process.env): string {
  const pepper = env.TOKEN_HASH_SECRET ?? env.JWT_REFRESH_SECRET ?? 'test-token-hash-secret-for-ci-testing-32-chars-minimum';
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

export function generateOpaqueRefreshCredential(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateTokens(payload: JWTPayload): { accessToken: string; refreshToken: string } {
  const sid = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  return {
    accessToken: generateAccessToken(payload, { sid }),
    refreshToken: generateRefreshJwt(payload, { sid, familyId }),
  };
}
