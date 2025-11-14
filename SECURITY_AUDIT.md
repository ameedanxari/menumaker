# SECURITY AUDIT REPORT - MenuMaker Application

## Executive Summary
Comprehensive security audit of MenuMaker frontend and backend. The application has a solid foundation with good use of frameworks and libraries for security, but has several critical and high-priority vulnerabilities that need immediate attention.

**Severity Levels:**
- CRITICAL: Immediate security risk, requires immediate fix
- HIGH: Serious security concern, requires prompt fix
- MEDIUM: Important security issue, should be fixed soon
- LOW: Minor security concern, good to fix

---

## 1. API ENDPOINTS INVENTORY

### Authentication Endpoints
- POST `/api/v1/auth/signup` - Public
- POST `/api/v1/auth/login` - Public
- GET `/api/v1/auth/me` - Authenticated (Bearer token)

### Business Management Endpoints
- POST `/api/v1/businesses` - Authenticated
- GET `/api/v1/businesses/:id` - Public (optional auth)
- GET `/api/v1/businesses/slug/:slug` - Public
- GET `/api/v1/businesses/me` - Authenticated
- PUT `/api/v1/businesses/:id` - Authenticated (owner only)
- GET `/api/v1/businesses/:id/settings` - Authenticated (owner only)
- PUT `/api/v1/businesses/:id/settings` - Authenticated (owner only)

### Menu Management Endpoints
- POST `/api/v1/menus` - Authenticated (owner only)
- GET `/api/v1/menus/:id` - Public (optional auth)
- GET `/api/v1/menus` - Public (requires businessId query param)
- GET `/api/v1/menus/current` - Public (requires businessId query param)
- PUT `/api/v1/menus/:id` - Authenticated (owner only)
- POST `/api/v1/menus/:id/publish` - Authenticated (owner only)
- POST `/api/v1/menus/:id/archive` - Authenticated (owner only)
- DELETE `/api/v1/menus/:id` - Authenticated (owner only)

### Dish Management Endpoints
- POST `/api/v1/dishes` - Authenticated (owner only)
- GET `/api/v1/dishes/:id` - Public
- GET `/api/v1/dishes` - Public (requires businessId query param)
- PUT `/api/v1/dishes/:id` - Authenticated (owner only)
- DELETE `/api/v1/dishes/:id` - Authenticated (owner only)
- POST `/api/v1/dishes/categories` - Authenticated (owner only)
- GET `/api/v1/dishes/categories` - Public (requires businessId query param)

### Order Management Endpoints
- POST `/api/v1/orders` - Public (creates new order)
- GET `/api/v1/orders/:id` - Public
- GET `/api/v1/orders` - Authenticated (owner only, requires businessId)
- PUT `/api/v1/orders/:id` - Authenticated (owner only)
- GET `/api/v1/orders/summary` - Authenticated (owner only)

### File Upload Endpoints
- POST `/api/v1/media/upload` - Authenticated
- POST `/api/v1/media/upload-multiple` - Authenticated
- DELETE `/api/v1/media` - Authenticated

### Reporting Endpoints
- GET `/api/v1/reports/orders/export` - Authenticated (owner only)
- GET `/api/v1/reports/dashboard` - Authenticated (owner only)

---

## 2. VALIDATION & SANITIZATION STATUS

### Backend Validation (Using Zod schemas)

#### Authentication ✅
- Email: Format validation
- Password: Length >= 8 characters
- **ISSUE**: No password complexity requirements enforced in signup (see CRITICAL #1)

#### Business ✅
- Name: Min 1, Max 255 characters
- Description: Max 1000 characters
- Logo URL: URL format validation
- Primary color: Hex color validation
- Locale: 2 characters
- Timezone: String validation
- Settings: Enum validation for delivery type, payment method

#### Dishes ✅
- Name: Min 1, Max 255 characters
- Description: Min 50, Max 500 characters
- Price: Integer >= 0
- Image URLs: URL format validation
- Category ID: UUID format validation

#### Menus ✅
- Title: Min 1, Max 255 characters
- Start/End dates: Date parsing and validation
- Menu items: UUID validation for dish IDs, price validation

#### Orders ✅
- Customer name: Min 1, Max 255 characters
- Phone: E.164 or local format (1-15 digits)
- Email: Email format (optional)
- Delivery address: Max 1000 characters (required for delivery orders)
- Items: Min 1 item required

### Frontend Validation
- Email format validation
- Password length >= 8 characters
- **ISSUE**: Password complexity not enforced (see CRITICAL #1)
- Price formatting (removes non-numeric characters except decimal)
- Phone number formatting (US format support)

---

## 3. CRITICAL VULNERABILITIES

### CRITICAL #1: Weak Password Policy
**Severity:** CRITICAL  
**Location:** 
- Backend: `/backend/src/utils/password.ts` - Password hashing config
- Shared: `/shared/src/validation/auth.ts` - Password requirements
- Frontend: `/frontend/src/utils/validation.ts` - Client-side rules

**Issue:** Password only requires 8 characters minimum. No complexity requirements (uppercase, lowercase, numbers, special chars).

**Risk:** Users can set weak passwords like "12345678" or "aaaaaaaa", making them vulnerable to brute force attacks.

**Evidence:**
```typescript
// Current validation - TOO WEAK
password: z.string().min(8, 'Password must be at least 8 characters'),

// Frontend claims it requires complexity but backend doesn't enforce
custom: {
  validate: (value: string) => /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value),
  message: 'Password must contain uppercase, lowercase, and a number',
},
```

**Recommendation:**
- Enforce password complexity on BACKEND (Zod schema)
- Require minimum 12 characters
- Require at least: 1 uppercase, 1 lowercase, 1 number, 1 special character
- Implement password strength meter on frontend

---

### CRITICAL #2: Hardcoded JWT Secret with Weak Default
**Severity:** CRITICAL  
**Location:** `/backend/src/utils/jwt.ts` (lines 9-11)

**Issue:** JWT secret has a weak default value that falls back if environment variable is not set.

**Risk:** If JWT_SECRET env var is not properly set in production, tokens can be forged by anyone knowing this default secret.

**Evidence:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
```

**Attack Scenario:** 
1. Attacker discovers default value from source code
2. Creates valid JWT tokens for any user
3. Gains unauthorized access to business data

**Recommendation:**
- **MUST** have JWT_SECRET in environment - NO DEFAULTS ALLOWED
- Throw error on startup if JWT_SECRET not set in production
- Use strong random secret (minimum 32 characters)
- Implement in main.ts startup validation

---

### CRITICAL #3: Unsafe File Deletion - Path Traversal Vulnerability
**Severity:** CRITICAL  
**Location:** `/backend/src/services/MediaService.ts` (lines 108-121)

**Issue:** File deletion uses unsafe path extraction from URL. Attacker can craft URLs to delete arbitrary files.

**Risk:** Complete loss of data integrity. Attackers can delete files not owned by them.

**Evidence:**
```typescript
async deleteFile(fileUrl: string): Promise<void> {
  try {
    // Extract filename from URL - VULNERABLE!
    const fileName = fileUrl.split('/').pop(); // Can be manipulated
    if (!fileName) {
      throw new Error('Invalid file URL');
    }
    await this.minioClient.removeObject(this.bucketName, fileName);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw error - file might already be deleted
  }
}
```

**Attack Scenario:**
1. Attacker uploads file: `/bucket/user1-image.jpg`
2. URL returned: `http://endpoint/bucket/timestamp-hash.jpg`
3. Attacker crafts request with URL: `http://endpoint/bucket/other-user-image.jpg`
4. File gets deleted despite being owned by another user

**Recommendation:**
- Store file reference in database with ownership info
- Verify ownership before deletion
- Use file ID instead of URL for deletion requests

---

### CRITICAL #4: Hardcoded S3/MinIO Credentials
**Severity:** CRITICAL  
**Location:** `/backend/src/services/MediaService.ts` (lines 18-19)

**Issue:** S3 credentials have weak defaults that are used if environment variables are not set.

**Risk:** Unauthorized access to S3/MinIO bucket containing all uploaded images.

**Evidence:**
```typescript
accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
```

**Recommendation:**
- Remove ALL default credentials
- Throw error on startup if credentials not properly configured
- Use IAM roles in production (AWS) or similar for infrastructure
- Rotate credentials regularly

---

## 4. HIGH PRIORITY VULNERABILITIES

### HIGH #1: Missing CSRF Protection
**Severity:** HIGH  
**Location:** `/backend/src/main.ts`

**Issue:** No CSRF token validation implemented. No `@fastify/csrf` or similar protection.

**Risk:** Cross-Site Request Forgery attacks possible on state-changing operations (POST, PUT, DELETE).

**Recommendation:**
- Implement CSRF token validation
- Use `@fastify/csrf` package or similar
- Validate tokens on all POST/PUT/DELETE requests
- Store tokens in secure httpOnly cookies

---

### HIGH #2: Tokens Not Using httpOnly Cookies (JWT stored in localStorage)
**Severity:** HIGH  
**Location:** `/frontend/src/stores/authStore.ts` (lines 104-111)

**Issue:** Tokens are stored in Zustand with persistence, which defaults to localStorage. JWTs in localStorage are vulnerable to XSS.

**Evidence:**
```typescript
persist(
  (set, get) => ({...}),
  {
    name: 'auth-storage',
    partialize: (state) => ({
      user: state.user,
      accessToken: state.accessToken, // STORED IN LOCALSTORAGE!
      isAuthenticated: state.isAuthenticated,
    }),
  }
)
```

**Risk:** 
- Any XSS vulnerability exposes tokens
- No protection against token theft
- Refresh tokens also compromised

**Recommendation:**
- Move tokens to httpOnly, secure, sameSite cookies
- Remove from localStorage entirely
- Implement refresh token rotation
- Only access tokens in memory during active session

---

### HIGH #3: Missing Input Validation on Category Creation
**Severity:** HIGH  
**Location:** `/backend/src/routes/dishes.ts` (lines 97-129)

**Issue:** POST `/dishes/categories` endpoint accepts name and description but doesn't validate them with Zod schema.

**Evidence:**
```typescript
fastify.post('/categories', {
  preHandler: authenticate,
}, async (request, reply) => {
  const { businessId, name, description } = request.body as {
    businessId: string;
    name: string;
    description?: string;
  };

  if (!businessId || !name) {
    // Only checks if empty, no validation of length, type, etc.
    ...
  }
```

**Risk:**
- Malicious input (XSS payloads, SQL injection attempts)
- No validation of string length
- No sanitization

**Recommendation:**
- Create `DishCategorySchema` with Zod validation
- Apply same validation as other endpoints
- Max length validation on name and description

---

### HIGH #4: Insecure Error Messages Leaking Information
**Severity:** HIGH  
**Location:** `/backend/src/services/AuthService.ts` & `/backend/src/middleware/errorHandler.ts`

**Issue:** Error handler in development mode returns stack traces and details. While protected by NODE_ENV check, error messages could still leak sensitive info.

**Evidence:**
```typescript
export async function errorHandler(...) {
  ...(process.env.NODE_ENV === 'development' && {
    details: (error as AppError).details,
    stack: error.stack,
  }),
}
```

Also, error messages differentiate between "user not found" and "invalid password", allowing user enumeration:
```typescript
if (!user) {
  throw new Error('Invalid email or password'); // User not found message
}
if (!isPasswordValid) {
  throw new Error('Invalid email or password'); // Wrong password message
}
```

**Risk:**
- User enumeration attacks possible
- In production, NODE_ENV might not be set correctly
- Stack traces reveal application structure

**Recommendation:**
- Always return generic "Invalid credentials" message
- Never leak whether email exists or password is wrong
- Ensure NODE_ENV properly set in all environments
- Implement centralized error handling with security-first defaults

---

### HIGH #5: No Rate Limiting on Authentication Endpoints
**Severity:** HIGH  
**Location:** `/backend/src/main.ts` (lines 61-64)

**Issue:** Rate limiting is global (100 requests per 15 minutes). Authentication endpoints need stricter limits.

**Evidence:**
```typescript
await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // Too lenient for auth
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
});
```

**Risk:** 
- Brute force attacks on login/signup possible
- 100 requests = many password attempts
- Can compromise weak passwords (see CRITICAL #1)

**Recommendation:**
- Implement stricter limits for `/auth/login` and `/auth/signup`
- Use per-IP rate limiting
- Implement progressive delays (exponential backoff)
- Lock account after N failed attempts
- Add CAPTCHA after multiple failed attempts

---

### HIGH #6: Public Order Creation Allows Customer Data Leak
**Severity:** HIGH  
**Location:** `/backend/src/routes/orders.ts` (line 10)

**Issue:** POST `/orders` is public with no authentication. Gets customer name, phone, email, delivery address.

**Evidence:**
```typescript
fastify.post('/', async (request, reply) => {
  // No authentication required
  const data = validateSchema(OrderCreateSchema, request.body);
  const order = await orderService.createOrder(data);
  // Returns order with customer details
})
```

**Risk:**
- Sensitive customer data (phone, email, address) collected without authentication
- No terms of service acceptance before data collection
- Data retention policy not enforced
- GDPR/privacy compliance issues

**Recommendation:**
- Add privacy policy acceptance requirement
- Implement data retention policies
- Encrypt customer data at rest
- Add verification email/SMS before order
- Implement "right to be forgotten" mechanism

---

## 5. MEDIUM PRIORITY VULNERABILITIES

### MEDIUM #1: Missing HTTPS/TLS Configuration
**Severity:** MEDIUM  
**Location:** `/backend/src/main.ts`

**Issue:** No HTTPS configuration. Application runs on HTTP in all environments by default.

**Risk:** Man-in-the-middle attacks possible, tokens exposed in transit.

**Evidence:** No HTTPS listener configuration in main.ts

**Recommendation:**
- Enforce HTTPS in production
- Add HSTS header (via Helmet, already installed)
- Set secure flag on cookies when using cookies
- Use environment-based configuration for SSL/TLS

---

### MEDIUM #2: Weak Content-Security-Policy Headers
**Severity:** MEDIUM  
**Location:** `/backend/src/main.ts` (lines 50-58)

**Issue:** CSP allows `data:` in imgSrc and `https:` which is too broad.

**Evidence:**
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline is problematic
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'], // Too broad!
  },
},
```

**Risk:** 
- XSS attacks possible with `unsafe-inline` for styles
- Image-based attacks possible with open https: policy

**Recommendation:**
- Remove `data:` from imgSrc (only allow specific domains)
- Remove `unsafe-inline` from styleSrc (use nonce or hash)
- Add `upgrade-insecure-requests` directive
- Add `frame-ancestors` directive
- Add `base-uri` directive

---

### MEDIUM #3: No Request Size Limits on JSON Endpoints
**Severity:** MEDIUM  
**Location:** Fastify configuration in `/backend/src/main.ts`

**Issue:** No bodyParser limit configuration for JSON endpoints. Only multipart has 5MB limit.

**Risk:** Denial of service through large JSON payloads.

**Recommendation:**
- Add bodySize limit to Fastify configuration
- Implement per-endpoint limits if needed
- Add monitoring for suspiciously large requests

---

### MEDIUM #4: Missing SQL Injection Prevention Documentation
**Severity:** MEDIUM  
**Status:** Actually OKAY - Using TypeORM with parameterized queries

**Note:** TypeORM uses parameterized queries throughout (checked), so SQL injection is not a direct risk. However:

**Recommendation:**
- Add development documentation warning against raw queries
- Implement linting rules to catch `query()` usage
- Code review checklist for database operations

---

### MEDIUM #5: No API Rate Limiting Per-User
**Severity:** MEDIUM  
**Location:** `/backend/src/main.ts`

**Issue:** Rate limiting is global by IP, not per-user. Authenticated users share the same limits.

**Risk:** One malicious authenticated user can DOS the service for others.

**Recommendation:**
- Implement per-user rate limiting for authenticated endpoints
- Different limits for different endpoints
- Premium users might get higher limits

---

### MEDIUM #6: Refresh Token Not Implemented
**Severity:** MEDIUM  
**Location:** `/backend/src/utils/jwt.ts`

**Issue:** Refresh tokens are generated but never used. No refresh endpoint exists.

**Risk:** 
- Access tokens can't be rotated
- Token revocation impossible
- Long-lived tokens pose security risk

**Evidence:**
```typescript
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
}
```

But no endpoint to use this refresh token!

**Recommendation:**
- Implement POST `/api/v1/auth/refresh` endpoint
- Validate refresh token and issue new access token
- Store refresh tokens in database
- Allow refresh token revocation
- Implement token rotation strategy

---

### MEDIUM #7: Missing Audit Logging
**Severity:** MEDIUM  
**Location:** Entire application

**Issue:** No audit logs for sensitive operations (user creation, business updates, order creation).

**Risk:** 
- No way to track who made what changes
- Compliance issues (audit trails required)
- Incident investigation difficult

**Recommendation:**
- Log all authentication events (login, signup, logout)
- Log all sensitive operations (CRUD on business, menus)
- Store logs securely with integrity protection
- Implement log retention policies
- Implement audit log viewing for administrators

---

## 6. LOW PRIORITY VULNERABILITIES

### LOW #1: Missing Security Headers
**Severity:** LOW  
**Location:** Helmet configuration

**Recommendation:**
- Add `X-Content-Type-Options: nosniff` (Helmet does this by default)
- Add `X-Frame-Options: DENY` (Helmet does this by default)  
- Add `X-XSS-Protection: 1; mode=block` (Helmet does this by default)
- Add `Permissions-Policy` header
- Add `Referrer-Policy: strict-origin-when-cross-origin`

---

### LOW #2: Missing API Documentation
**Severity:** LOW  
**Location:** No OpenAPI/Swagger documentation

**Recommendation:**
- Add Swagger/OpenAPI documentation
- Generate from code using decorators or comments
- Auto-generate client SDKs

---

### LOW #3: Weak Password Validation on Frontend
**Severity:** LOW  
**Location:** `/frontend/src/utils/validation.ts`

**Issue:** Frontend validation doesn't match what will be enforced on backend.

**Recommendation:**
- Once backend validation is strengthened, update frontend to match
- Show real-time password strength indicator
- Provide feedback on all requirements

---

### LOW #4: Console Logging in Production Code
**Severity:** LOW  
**Location:** `/backend/src/services/MediaService.ts` (lines 50, 118)

**Evidence:**
```typescript
console.error('Error ensuring bucket exists:', error);
console.error('Error deleting file:', error);
```

**Risk:** 
- Sensitive information might be logged
- Performance impact
- Security information exposed in logs

**Recommendation:**
- Use logger instance instead of console
- Configure log levels per environment
- Sanitize sensitive data from logs

---

## 7. SECURITY STRENGTHS

The application implements several good security practices:

1. **Password Hashing** ✅ - Uses bcrypt with 10 salt rounds
2. **JWT for Authentication** ✅ - Stateless authentication
3. **Authorization Checks** ✅ - Owner verification on all resource operations
4. **Input Validation** ✅ - Uses Zod schemas for validation (except category creation)
5. **Helmet Headers** ✅ - Security headers configured
6. **Rate Limiting** ✅ - Global rate limiting in place
7. **No SQL Injection** ✅ - Uses parameterized queries (TypeORM)
8. **XSS Protection** ✅ - React prevents XSS by default
9. **CORS Configured** ✅ - CORS origin restricted to frontend URL
10. **File Upload Validation** ✅ - MIME type and size validation
11. **Multipart Limits** ✅ - Size limits on uploads
12. **TypeScript** ✅ - Provides type safety

---

## 8. REMEDIATION ROADMAP

### Phase 1: CRITICAL (Immediate - Do First)
- [ ] Enforce strong password policy (CRITICAL #1)
- [ ] Fix JWT secret fallback (CRITICAL #2)
- [ ] Fix file deletion vulnerability (CRITICAL #3)
- [ ] Remove hardcoded credentials (CRITICAL #4)

### Phase 2: HIGH (Within 1 week)
- [ ] Implement CSRF protection (HIGH #1)
- [ ] Move tokens to httpOnly cookies (HIGH #2)
- [ ] Add category validation (HIGH #3)
- [ ] Generic error messages (HIGH #4)
- [ ] Auth rate limiting (HIGH #5)
- [ ] Privacy/data handling (HIGH #6)

### Phase 3: MEDIUM (Within 2 weeks)
- [ ] HTTPS/TLS enforcement (MEDIUM #1)
- [ ] Fix CSP headers (MEDIUM #2)
- [ ] Request size limits (MEDIUM #3)
- [ ] Per-user rate limiting (MEDIUM #5)
- [ ] Implement refresh token endpoint (MEDIUM #6)
- [ ] Add audit logging (MEDIUM #7)

### Phase 4: LOW (Nice to have)
- [ ] Additional security headers (LOW #1)
- [ ] API documentation (LOW #2)
- [ ] Frontend password validation (LOW #3)
- [ ] Remove console logging (LOW #4)

---

## 9. TESTING RECOMMENDATIONS

### Security Testing
1. Penetration testing on authentication flows
2. OWASP Top 10 testing
3. Input fuzzing on all endpoints
4. Authorization testing (try accessing other user's resources)
5. JWT tampering tests
6. Rate limit bypass attempts
7. File upload malware testing

### Automated Testing
- Add unit tests for validation functions
- Add integration tests for auth flows
- Add security-specific lint rules
- Add dependency scanning for vulnerabilities

---

## 10. DEPLOYMENT CHECKLIST

Before deploying to production:
- [ ] JWT_SECRET properly set (strong 32+ character random string)
- [ ] S3/MinIO credentials not using defaults
- [ ] NODE_ENV=production set
- [ ] HTTPS/TLS enabled
- [ ] CORS origin correctly configured
- [ ] Database backups configured
- [ ] Rate limits adjusted for production
- [ ] Error messages don't leak information
- [ ] Audit logging enabled
- [ ] All CRITICAL vulnerabilities fixed
- [ ] Security testing completed

---

## CONCLUSION

The MenuMaker application has a reasonable security foundation but requires immediate attention to CRITICAL vulnerabilities, especially around JWT secret management and authentication security. The comprehensive recommendations above should be prioritized and implemented systematically.

**Overall Risk Level:** HIGH (due to 4 CRITICAL vulnerabilities)

Once CRITICAL issues are resolved, move to HIGH priority items. The application follows good security practices in most areas and with these fixes will be substantially more secure.
