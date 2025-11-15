# GDPR Compliance Guide (Phase 2.6)

**Status**: ✅ **FOUNDATION IMPLEMENTED**
**Feature**: GDPR Compliance Foundation for India/US markets
**Effort**: 3-4 developer-days
**Version**: 1.0

---

## Overview

MenuMaker's GDPR Foundation provides baseline compliance for data protection regulations. This Phase 2 implementation covers essential requirements for India and US markets, with a foundation for future EU expansion (Phase 3).

### Key Features

- 🍪 **Cookie Consent Tracking** - GDPR-compliant consent banner
- 🗑️ **Account Deletion Workflow** - 30-day grace period with manual execution
- 📄 **Legal Template Management** - Privacy Policy, T&C, Refund Policy generators
- 🔒 **Data Retention Policy** - Inactive account tracking and deletion
- 📊 **Consent Analytics** - Track consent rates and preferences

---

## Phase 2 vs Phase 3 Scope

### ✅ Phase 2 Foundation (Current)

- Cookie consent banner (Essential, Analytics, Marketing)
- Basic account deletion request (30-day grace period)
- Manual admin execution of deletions
- Privacy policy template generator
- Data retention tracking

### ⏳ Phase 3 Full Compliance (Future)

- Data portability (export all data as JSON/CSV)
- Consent management dashboard
- **Automated deletion cron job** (currently manual)
- Audit trail for PII access
- Third-party GDPR compliance audit
- DPO (Data Protection Officer) contact

---

## Database Schema

### 1. Cookie Consents Table

```sql
CREATE TABLE cookie_consents (
  id UUID PRIMARY KEY,
  visitor_id VARCHAR(255),         -- Anonymous browser ID
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  essential BOOLEAN DEFAULT TRUE,  -- Always true
  analytics BOOLEAN DEFAULT FALSE, -- Google/Firebase Analytics
  marketing BOOLEAN DEFAULT FALSE, -- Ads/Marketing cookies
  consent_method VARCHAR(50),      -- 'accept_all' | 'reject_all' | 'customize'
  language VARCHAR(10) DEFAULT 'en',
  expires_at TIMESTAMP,            -- 1 year (accepted) or 7 days (rejected)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes**: `visitor_id`, `ip_address`

### 2. Deletion Requests Table

```sql
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'cancelled' | 'completed' | 'failed'
  reason TEXT,
  scheduled_deletion_date TIMESTAMP,    -- created_at + 30 days
  cancelled_at TIMESTAMP,
  completed_at TIMESTAMP,
  admin_user_id UUID,                   -- Admin who executed (Phase 2: manual)
  admin_notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes**: `user_id`, `status`, `scheduled_deletion_date`

### 3. Legal Templates Table

```sql
CREATE TABLE legal_templates (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id), -- NULL = system default
  template_type VARCHAR(100),                  -- 'privacy_policy' | 'terms_conditions' | 'refund_policy' | 'allergen_disclaimer'
  jurisdiction VARCHAR(10) DEFAULT 'IN',       -- 'IN' | 'US' | 'GB' | 'EU'
  content TEXT,                                -- Markdown content
  customizations TEXT,                         -- JSON: {"business_name": "...", "email": "..."}
  version VARCHAR(50) DEFAULT '1.0',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes**: `(business_id, template_type)`, `jurisdiction`, `is_published`

---

## API Endpoints

### 1. Cookie Consent

**POST /api/v1/gdpr/cookie-consent** (Public)

Record cookie consent preferences.

**Request**:
```json
{
  "visitor_id": "uuid-from-browser",
  "consent_method": "accept_all",
  "analytics": true,
  "marketing": true,
  "language": "en"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "consent_id",
    "visitor_id": "uuid",
    "consent_method": "accept_all",
    "essential": true,
    "analytics": true,
    "marketing": true,
    "expires_at": "2026-11-15T00:00:00Z"
  }
}
```

---

**GET /api/v1/gdpr/cookie-consent/:visitor_id** (Public)

Get cookie consent for visitor.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "consent_id",
    "visitor_id": "uuid",
    "consent_method": "customize",
    "essential": true,
    "analytics": false,
    "marketing": false,
    "expires_at": "2026-11-15T00:00:00Z"
  }
}
```

---

### 2. Account Deletion

**POST /api/v1/gdpr/deletion-request** (Auth Required)

Request account deletion (30-day grace period).

**Request**:
```json
{
  "reason": "No longer need the service"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Account deletion requested. You have 30 days to cancel.",
  "data": {
    "id": "deletion_id",
    "status": "pending",
    "scheduled_deletion_date": "2025-12-15T00:00:00Z",
    "created_at": "2025-11-15T00:00:00Z"
  }
}
```

---

**DELETE /api/v1/gdpr/deletion-request** (Auth Required)

Cancel account deletion request.

**Response**:
```json
{
  "success": true,
  "message": "Account deletion cancelled.",
  "data": {
    "id": "deletion_id",
    "status": "cancelled",
    "cancelled_at": "2025-11-20T00:00:00Z"
  }
}
```

---

**GET /api/v1/gdpr/deletion-request/status** (Auth Required)

Get deletion request status.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "deletion_id",
    "status": "pending",
    "scheduled_deletion_date": "2025-12-15T00:00:00Z",
    "created_at": "2025-11-15T00:00:00Z"
  }
}
```

---

### 3. Legal Templates

**POST /api/v1/gdpr/legal-template** (Auth Required)

Create or update legal template.

**Request**:
```json
{
  "template_type": "privacy_policy",
  "jurisdiction": "IN",
  "content": "# Privacy Policy\n\n...",
  "customizations": {
    "business_name": "My Restaurant",
    "email": "contact@restaurant.com",
    "phone": "+91 98765 43210",
    "address": "123 Main St, Mumbai"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "template_id",
    "template_type": "privacy_policy",
    "jurisdiction": "IN",
    "version": "1.0",
    "is_published": false,
    "created_at": "2025-11-15T00:00:00Z"
  }
}
```

---

**POST /api/v1/gdpr/legal-template/:id/publish** (Auth Required)

Publish legal template.

**Response**:
```json
{
  "success": true,
  "message": "Legal template published",
  "data": {
    "id": "template_id",
    "template_type": "privacy_policy",
    "version": "1.0",
    "is_published": true,
    "published_at": "2025-11-15T00:00:00Z"
  }
}
```

---

**GET /api/v1/gdpr/legal-template/:template_type** (Public)

Get legal template (for displaying on menu footer).

**Query Params**: `?business_id=...&jurisdiction=IN`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "template_id",
    "template_type": "privacy_policy",
    "jurisdiction": "IN",
    "content": "# Privacy Policy\n\nYour business name: My Restaurant...",
    "version": "1.0",
    "published_at": "2025-11-15T00:00:00Z"
  }
}
```

---

## Usage Examples

### Frontend: Cookie Consent Banner

```typescript
// On first page load
async function checkCookieConsent() {
  const visitorId = localStorage.getItem('menumaker_visitor_id') || generateUUID();
  localStorage.setItem('menumaker_visitor_id', visitorId);

  // Check if consent already recorded
  const response = await fetch(`/api/v1/gdpr/cookie-consent/${visitorId}`);

  if (response.status === 404) {
    // Show cookie consent banner
    showCookieBanner();
  } else {
    const data = await response.json();
    // Apply consent preferences
    if (data.data.analytics) {
      enableGoogleAnalytics();
    }
    if (data.data.marketing) {
      enableMarketingCookies();
    }
  }
}

// When user accepts/rejects
async function recordConsent(method: 'accept_all' | 'reject_all' | 'customize', preferences?: any) {
  const visitorId = localStorage.getItem('menumaker_visitor_id');

  await fetch('/api/v1/gdpr/cookie-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitor_id: visitorId,
      consent_method: method,
      ...preferences,
    }),
  });

  // Hide banner
  hideCookieBanner();
}
```

---

### Frontend: Account Deletion

```typescript
async function requestAccountDeletion(reason: string) {
  const response = await fetch('/api/v1/gdpr/deletion-request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  const data = await response.json();

  if (data.success) {
    alert(`Account deletion requested. Scheduled for: ${data.data.scheduled_deletion_date}`);
    alert('You have 30 days to cancel by logging back in.');
  }
}

async function cancelDeletion() {
  const response = await fetch('/api/v1/gdpr/deletion-request', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  if (data.success) {
    alert('Account deletion cancelled!');
  }
}
```

---

## Admin Operations

### Manual Deletion Execution (Phase 2)

**Phase 2 Limitation**: Account deletions must be manually executed by an admin after the 30-day grace period.

**Admin Process**:

1. **List Pending Deletions**:
```typescript
import { GDPRService } from './services/GDPRService';

const pendingDeletions = await GDPRService.listPendingDeletions();

console.log('Pending Deletions:', pendingDeletions.map(d => ({
  user_email: d.user_email,
  scheduled_date: d.scheduled_deletion_date,
  days_remaining: Math.ceil((d.scheduled_deletion_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
})));
```

2. **Execute Deletion** (after 30 days):
```typescript
// Manual execution by admin
await GDPRService.executeAccountDeletion(
  'deletion_request_id',
  'admin_user_id',
  'Executed after 30-day grace period'
);
```

3. **SQL Query** (for admins):
```sql
-- List deletions due today or overdue
SELECT
  id,
  user_email,
  scheduled_deletion_date,
  EXTRACT(DAY FROM (scheduled_deletion_date - NOW())) as days_remaining
FROM deletion_requests
WHERE status = 'pending'
  AND scheduled_deletion_date <= NOW()
ORDER BY scheduled_deletion_date ASC;
```

**Phase 3 Enhancement**: Automated cron job will execute deletions automatically.

---

## Data Retention Policy

### Active Accounts
- Personal information retained indefinitely while account is active
- Order history retained for seller's records and analytics

### Inactive Accounts
- Accounts inactive for **12 months** will be flagged for review
- Notification sent 30 days before deletion
- User can log in to keep account active

### Deleted Accounts
- 30-day grace period for recovery
- After 30 days: **Permanent deletion** (hard delete)
- All related data deleted via CASCADE (menus, orders, etc.)

---

## Privacy Policy Templates

### Available Templates

1. **Privacy Policy (India)**: `/backend/templates/legal/privacy-policy-IN.md`
   - GDPR-inspired but tailored for India
   - Covers: Data collection, usage, retention, user rights, cookies

2. **Privacy Policy (US)**: Phase 3
3. **Privacy Policy (EU)**: Phase 3 (full GDPR compliance)

### Template Customization

Templates support placeholders:
- `{{business_name}}` - Your restaurant name
- `{{email}}` - Contact email
- `{{phone}}` - Contact phone
- `{{address}}` - Physical address
- `{{last_updated}}` - Last policy update date
- `{{current_year}}` - Current year

**Example**:
```markdown
# Privacy Policy

**Business**: {{business_name}}
**Contact**: {{email}} | {{phone}}
```

After customization:
```markdown
# Privacy Policy

**Business**: Tasty Bites Restaurant
**Contact**: contact@tastybites.com | +91 98765 43210
```

---

## Compliance Checklist

### ✅ Phase 2 Compliance (India/US)

- [x] Cookie consent banner implemented
- [x] Account deletion request workflow
- [x] 30-day grace period for recovery
- [x] Privacy policy generator
- [x] Data retention policy documented
- [x] Manual admin deletion process

### ⏳ Phase 3 Compliance (EU Market)

- [ ] Data portability (export JSON/CSV)
- [ ] Consent management dashboard
- [ ] Automated deletion cron job
- [ ] Audit trail for PII access
- [ ] Third-party GDPR audit
- [ ] DPO contact information

---

## Troubleshooting

### Issue: Cookie consent not persisting

**Cause**: Browser localStorage or cookies disabled

**Fix**:
- Check if `localStorage.getItem('menumaker_visitor_id')` exists
- Ensure cookies are enabled for analytics/marketing consent
- Verify API call to `/api/v1/gdpr/cookie-consent` succeeded

---

### Issue: Deletion request fails

**Cause**: Active deletion request already exists

**Debug**:
```sql
SELECT * FROM deletion_requests WHERE user_id = 'user_id' AND status = 'pending';
```

**Fix**:
- Cancel existing request first
- Or wait for scheduled deletion date

---

## Security Considerations

### Data Encryption
- All API traffic over HTTPS (SSL/TLS)
- Passwords hashed with bcrypt
- No plaintext storage of sensitive data

### Access Controls
- Cookie consent: Public (no auth required)
- Deletion requests: Authenticated users only
- Admin operations: Admin users only (Phase 3: RBAC)

### Audit Trail
- Deletion requests logged with timestamps
- Admin actions tracked (`admin_user_id`, `admin_notes`)
- Legal template versions tracked

---

## Support

**MenuMaker Issues**: https://github.com/ameedanxari/menumaker/issues
**Spec Reference**: `/specs/001-menu-maker/phase-2-spec.md`
**Privacy Email**: privacy@menumaker.app

---

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: PHASE 2 FOUNDATION COMPLETE ✅
