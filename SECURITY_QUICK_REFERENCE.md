# MenuMaker Security Audit - Quick Reference

## Critical Issues (FIX FIRST!)

### 1. Weak Password Policy - CRITICAL
- Passwords only need 8 characters, no complexity
- **File:** `/backend/src/validation/auth.ts`
- **Fix:** Require 12+ chars, uppercase, lowercase, number, special char
- **Impact:** Users can set weak passwords like "12345678"

### 2. JWT Secret Hardcoded - CRITICAL
- Falls back to `'your-secret-key-change-in-production'`
- **File:** `/backend/src/utils/jwt.ts` line 9
- **Fix:** Throw error if JWT_SECRET not set, require 32+ chars
- **Impact:** Attackers can forge tokens

### 3. Path Traversal in File Deletion - CRITICAL
- Uses `fileUrl.split('/').pop()` to get filename
- **File:** `/backend/src/services/MediaService.ts` line 111
- **Fix:** Store file IDs in database, verify ownership
- **Impact:** Users can delete other users' files

### 4. Hardcoded S3 Credentials - CRITICAL
- Defaults to 'minioadmin' username/password
- **File:** `/backend/src/services/MediaService.ts` line 18-19
- **Fix:** Remove all defaults, require env vars
- **Impact:** Unauthorized access to all uploaded files

---

## High Priority Issues (Fix within 1 week)

| Issue | Location | Fix |
|-------|----------|-----|
| No CSRF Protection | `/main.ts` | Add @fastify/csrf |
| JWT in localStorage | `/frontend/src/stores/authStore.ts` | Move to httpOnly cookies |
| Missing Category Validation | `/backend/src/routes/dishes.ts:97` | Add Zod schema |
| User Enumeration (Error Messages) | `/backend/src/services/AuthService.ts` | Generic error messages |
| Weak Auth Rate Limiting | `/main.ts:61` | Limit login/signup to 5 requests/15min |
| Privacy Issues | `/backend/src/routes/orders.ts` | Data retention policy |

---

## Medium Priority Issues

| Issue | Location | Impact |
|-------|----------|--------|
| No HTTPS | `/main.ts` | MitM attacks possible |
| Weak CSP Headers | `/main.ts:50` | XSS possible |
| No request size limits | Fastify config | DoS attacks |
| No per-user rate limiting | Rate limit config | User DoS possible |
| Refresh token not used | `/backend/src/utils/jwt.ts` | Token rotation impossible |
| No audit logging | Entire app | Compliance issues |

---

## Input Points Summary

### Forms (Frontend)
- Login/Signup: Email, Password (needs complexity)
- Business Setup: Name, description, color, timezone
- Menu Creation: Title, start/end dates
- Dish Creation: Name, description, price, category, image
- Order Creation (public): Name, phone, email, address

### API Endpoints (Backend)
- All endpoints validated with Zod EXCEPT: POST /dishes/categories

### Authentication
- Bearer token in Authorization header
- Tokens stored in localStorage (INSECURE - should be httpOnly)
- No refresh token endpoint

---

## Security Strengths
✅ Password hashing (bcrypt with 10 rounds)
✅ Input validation (Zod schemas)
✅ Authorization checks (owner verification)
✅ No SQL injection (parameterized queries)
✅ No XSS (React prevents it)
✅ CORS configured
✅ Helmet security headers
✅ File upload limits

---

## Deployment Checklist

Before going to production:
- [ ] Set strong JWT_SECRET (32+ random chars)
- [ ] Remove S3 credential defaults
- [ ] Fix password requirements
- [ ] Enable HTTPS/TLS
- [ ] Fix file deletion logic
- [ ] Add CSRF protection
- [ ] Move tokens to httpOnly cookies
- [ ] Add auth rate limiting
- [ ] Test all CRITICAL fixes
- [ ] Set NODE_ENV=production

---

## Files Most Critical to Review
1. `/backend/src/utils/jwt.ts` - JWT secret management
2. `/backend/src/services/MediaService.ts` - File operations
3. `/shared/src/validation/auth.ts` - Password requirements
4. `/backend/src/services/AuthService.ts` - Auth logic
5. `/frontend/src/stores/authStore.ts` - Token storage

---

## Overall Risk Assessment
**Current Risk Level:** HIGH

Due to 4 CRITICAL vulnerabilities affecting authentication and file access. These must be fixed before production deployment.

**After fixes applied:** MEDIUM (some HIGH issues remain but CRITICAL resolved)

---

See `SECURITY_AUDIT.md` for full detailed report with code examples and recommendations.
