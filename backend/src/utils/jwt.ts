import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  businessId?: string;
}

// Security: Require JWT_SECRET to be set and validate strength
const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Application cannot start without a secure JWT secret.');
}
if (JWT_SECRET_ENV.length < 32) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters long for adequate security.');
}

const JWT_SECRET: string = JWT_SECRET_ENV;
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function generateTokens(payload: JWTPayload): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
