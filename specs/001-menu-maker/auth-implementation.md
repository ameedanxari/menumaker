# Authentication Implementation Specification

**Version**: 1.0
**Phase**: Phase 1 (MVP)
**Last Updated**: 2025-11-12

---

## Overview

MenuMaker uses JWT-based authentication with refresh tokens for secure, stateless authentication. This document specifies the complete implementation details for Phase 1 MVP.

---

## JWT Token Structure

### Access Token (15-minute expiry)

```typescript
interface AccessTokenPayload {
  sub: string;          // User UUID
  email: string;        // User email
  business_id: string | null;  // Business UUID (null if no business yet)
  iat: number;          // Issued at (Unix timestamp)
  exp: number;          // Expires at (Unix timestamp)
  type: 'access';       // Token type
}
```

**Example JWT:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InNlbGxlckBleGFtcGxlLmNvbSIsImJ1c2luZXNzX2lkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDA5MDAsInR5cGUiOiJhY2Nlc3MifQ.signature
```

### Refresh Token (7-day expiry)

```typescript
interface RefreshTokenPayload {
  sub: string;          // User UUID
  jti: string;          // Token ID (UUID) for revocation tracking
  iat: number;          // Issued at (Unix timestamp)
  exp: number;          // Expires at (Unix timestamp)
  type: 'refresh';      // Token type
}
```

---

## Token Generation

### Environment Variables

```bash
# JWT Secret (min 32 characters, use crypto.randomBytes(64).toString('hex'))
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars-long

# Token expiry durations
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
```

### Implementation (Node.js/TypeORM)

```typescript
// src/auth/jwt.service.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class JWTService {
  private readonly secret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.secret = process.env.JWT_SECRET!;
    this.accessTokenExpiry = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
  }

  generateAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      business_id: user.business_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
      type: 'access'
    };

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.accessTokenExpiry
    });
  }

  generateRefreshToken(user: User): string {
    const tokenId = uuidv4();

    const payload: RefreshTokenPayload = {
      sub: user.id,
      jti: tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      type: 'refresh'
    };

    // Store refresh token in database for revocation capability
    this.storeRefreshToken(user.id, tokenId, payload.exp);

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.refreshTokenExpiry
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token has been revoked
      if (this.isTokenRevoked(decoded.jti)) {
        throw new Error('Refresh token has been revoked');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  private async storeRefreshToken(userId: string, tokenId: string, expiresAt: number): Promise<void> {
    // Store in database for revocation tracking
    await RefreshToken.create({
      id: tokenId,
      user_id: userId,
      expires_at: new Date(expiresAt * 1000),
      revoked: false
    });
  }

  private async isTokenRevoked(tokenId: string): Promise<boolean> {
    const token = await RefreshToken.findOne({ where: { id: tokenId } });
    return token?.revoked || false;
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await RefreshToken.update({ id: tokenId }, { revoked: true });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.update({ user_id: userId }, { revoked: true });
  }
}
```

---

## Database Entity for Refresh Tokens

```typescript
// src/models/RefreshToken.ts
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

**Migration:**
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

---

## Authentication Flow

### 1. Sign Up Flow

**Endpoint:** `POST /auth/signup`

```typescript
// Request
{
  "email": "seller@example.com",
  "password": "SecurePassword123"
}

// Response (201 Created)
{
  "token": "eyJhbGci...",           // Access token (15 min)
  "refresh_token": "eyJhbGci...",   // Refresh token (7 days)
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "seller@example.com",
    "business_id": null,
    "created_at": "2025-11-12T10:00:00Z"
  }
}
```

**Implementation:**
1. Validate email format and password strength (min 8 chars)
2. Check if email already exists (return 409 Conflict)
3. Hash password using bcrypt (10 rounds)
4. Create user record
5. Generate access + refresh tokens
6. Return tokens + user data

### 2. Login Flow

**Endpoint:** `POST /auth/login`

```typescript
// Request
{
  "email": "seller@example.com",
  "password": "SecurePassword123"
}

// Response (200 OK)
{
  "token": "eyJhbGci...",           // Access token (15 min)
  "refresh_token": "eyJhbGci...",   // Refresh token (7 days)
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "seller@example.com",
    "business_id": "660e8400-e29b-41d4-a716-446655440000",
    "created_at": "2025-11-12T10:00:00Z"
  }
}
```

**Implementation:**
1. Find user by email
2. Compare password using bcrypt.compare()
3. If invalid, return 401 Unauthorized
4. Generate new access + refresh tokens
5. Return tokens + user data

### 3. Refresh Token Flow

**Endpoint:** `POST /auth/refresh`

```typescript
// Request
{
  "refresh_token": "eyJhbGci..."
}

// Response (200 OK)
{
  "token": "eyJhbGci...",           // New access token (15 min)
  "refresh_token": "eyJhbGci..."    // New refresh token (7 days)
}
```

**Implementation:**
1. Verify refresh token signature
2. Check if token is revoked
3. Check if token is expired
4. Load user from database
5. Generate new access token
6. Generate new refresh token (optional: rotate refresh tokens)
7. Revoke old refresh token
8. Return new tokens

### 4. Logout Flow

**Endpoint:** `POST /auth/logout`

```typescript
// Request Headers
Authorization: Bearer <access_token>

// Request Body
{
  "refresh_token": "eyJhbGci..."
}

// Response (204 No Content)
```

**Implementation:**
1. Extract refresh token from request
2. Revoke refresh token in database
3. Return 204 No Content

---

## Middleware: Protected Routes

```typescript
// src/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header'
        }
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const jwtService = new JWTService();
    const decoded = jwtService.verifyAccessToken(token);

    // Attach user info to request
    request.user = {
      id: decoded.sub,
      email: decoded.email,
      business_id: decoded.business_id
    };
  } catch (error) {
    return reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token'
      }
    });
  }
}
```

**Usage:**
```typescript
// Protected route example
fastify.get('/api/v1/auth/me', {
  preHandler: [authenticateJWT]
}, async (request, reply) => {
  const user = await User.findOne({ where: { id: request.user.id } });
  return user;
});
```

---

## Password Hashing

### Bcrypt Configuration

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10; // Balance between security and performance

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
```

---

## Token Revocation Strategy

### Scenarios Requiring Revocation

1. **User Logout**: Revoke specific refresh token
2. **Password Change**: Revoke all user refresh tokens
3. **Account Deletion**: Revoke all user refresh tokens
4. **Security Breach**: Admin can revoke all tokens for a user

### Cleanup Strategy

**Cron Job**: Daily cleanup of expired refresh tokens

```typescript
// src/jobs/cleanup-expired-tokens.ts
import { LessThan } from 'typeorm';

export async function cleanupExpiredTokens() {
  const deleted = await RefreshToken.delete({
    expires_at: LessThan(new Date())
  });

  console.log(`Cleaned up ${deleted.affected} expired refresh tokens`);
}

// Schedule: Run daily at 2 AM
// Cron: 0 2 * * *
```

---

## Security Best Practices

### 1. JWT Secret Management
- ✅ Use cryptographically secure random string (min 32 bytes)
- ✅ Store in environment variable, never in code
- ✅ Rotate secret periodically (requires re-authentication)
- ✅ Use different secrets for staging/production

### 2. Token Expiry
- ✅ Access tokens: Short expiry (15 min) - limits damage if stolen
- ✅ Refresh tokens: Longer expiry (7 days) - better UX for PWA
- ✅ Never store tokens in localStorage (use httpOnly cookies in production)

### 3. Password Security
- ✅ Min 8 characters (enforce client + server side)
- ✅ Bcrypt with 10 rounds (good balance for 2025 hardware)
- ✅ Never log or transmit passwords in plain text
- ✅ Rate limit login attempts (max 5 per 15 min per IP)

### 4. HTTPS Only
- ✅ All authentication endpoints MUST use HTTPS in production
- ✅ Set `Secure` flag on cookies
- ✅ Reject HTTP requests on auth endpoints

---

## Error Handling

### Standard Auth Errors

```typescript
// 401 Unauthorized - Invalid credentials
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}

// 401 Unauthorized - Token expired
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired. Please refresh."
  }
}

// 401 Unauthorized - Token revoked
{
  "error": {
    "code": "TOKEN_REVOKED",
    "message": "Refresh token has been revoked. Please log in again."
  }
}

// 409 Conflict - Email already exists
{
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "An account with this email already exists"
  }
}

// 429 Too Many Requests - Rate limit exceeded
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again in 15 minutes."
  }
}
```

---

## Testing Checklist

### Unit Tests
- [ ] JWT generation and verification
- [ ] Password hashing and comparison
- [ ] Refresh token storage and retrieval
- [ ] Token revocation logic

### Integration Tests
- [ ] Sign up with valid credentials
- [ ] Sign up with existing email (409 Conflict)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (401)
- [ ] Refresh token with valid token
- [ ] Refresh token with revoked token (401)
- [ ] Access protected endpoint with valid token
- [ ] Access protected endpoint with expired token (401)
- [ ] Logout and verify token is revoked

### Security Tests
- [ ] JWT signature validation
- [ ] Token type validation (access vs refresh)
- [ ] Expired token rejection
- [ ] Revoked token rejection
- [ ] Password strength enforcement

---

## Migration from Phase 1 to Phase 2

**Phase 2 Changes** (if needed):
- Add `roles` field to JWT payload (for admin backend Phase 3)
- Add `permissions` array for fine-grained access control
- Implement OAuth2 for social login (Google, Facebook)

**Backward Compatibility**:
- Existing tokens remain valid during migration
- No breaking changes to token structure

---

## References

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Bcrypt NPM Package](https://www.npmjs.com/package/bcrypt)
- [jsonwebtoken NPM Package](https://www.npmjs.com/package/jsonwebtoken)

---

**Document Status**: ✅ Complete
**Implementation Estimate**: 2-3 days (1 developer)
**Dependencies**: PostgreSQL, bcrypt, jsonwebtoken
**Next**: Implement auth routes → Test with Postman → Integrate with frontend
