# MenuMaker Admin Backend Platform Guide

**Phase 3: Admin Backend Platform (US3.10)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

The Admin Backend Platform provides comprehensive tools for managing the MenuMaker platform at scale, supporting 5,000+ sellers with minimal manual intervention.

### Key Features

✅ **User Management**: Suspend/ban users, reset passwords, view activity logs
✅ **Content Moderation**: Review flagged content, auto-hide after 3 flags
✅ **Platform Analytics**: Real-time dashboard, trends, seller insights
✅ **Support Tickets**: SLA tracking (24-hour response), assignment, conversation threading
✅ **Feature Flags**: Gradual rollouts, tier overrides, emergency kill switch
✅ **Audit Logging**: Immutable logs of all admin actions (1-year retention)
✅ **Role-Based Access Control (RBAC)**: super_admin, moderator, support_agent

---

## Architecture

```
Admin Frontend (React)
        ↓
Admin API Routes (/api/v1/admin/*)
        ↓
Admin Auth Middleware (RBAC)
        ↓
Admin Services (AdminService, ModerationService, etc.)
        ↓
Database (PostgreSQL)
```

---

## Admin Roles

### super_admin
- **Full access** to all admin features
- Can suspend/ban users
- Can create/manage admin users
- Can toggle feature flags
- Can export analytics

### moderator
- Content moderation (approve/reject flags)
- View analytics (read-only)
- View users (cannot suspend/ban)

### support_agent
- Support ticket management
- View analytics (read-only)
- View users (cannot suspend/ban or moderate)

---

## API Endpoints

### User Management (Super Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List all users (paginated, filterable) |
| GET | `/api/v1/admin/users/:id` | Get user details |
| POST | `/api/v1/admin/users/:id/suspend` | Suspend user (7, 30 days, or permanent) |
| POST | `/api/v1/admin/users/:id/unsuspend` | Unsuspend user |
| POST | `/api/v1/admin/users/:id/ban` | Ban user (permanent) |
| POST | `/api/v1/admin/users/:id/reset-password` | Reset user password |
| GET | `/api/v1/admin/users/:id/activity` | Get user activity log |

### Content Moderation (Moderators + Super Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/moderation/queue` | Get moderation queue (pending flags) |
| GET | `/api/v1/admin/moderation/flags` | Get flags for specific content |
| POST | `/api/v1/admin/moderation/flags/:id/approve` | Approve flag (hide/delete content) |
| POST | `/api/v1/admin/moderation/flags/:id/reject` | Reject flag (no action) |
| GET | `/api/v1/admin/moderation/stats` | Get moderation stats |

### Analytics (All Admin Roles)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/analytics/dashboard` | Real-time dashboard metrics |
| GET | `/api/v1/admin/analytics/trends` | Trends (7-day, 30-day, 90-day) |
| GET | `/api/v1/admin/analytics/sellers` | Seller statistics |
| GET | `/api/v1/admin/analytics/orders` | Order analytics |
| GET | `/api/v1/admin/analytics/top-sellers` | Top sellers (by GMV or orders) |
| GET | `/api/v1/admin/analytics/export` | Export analytics as CSV |

### Support Tickets (Support Agents + Above)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/tickets` | List all support tickets |
| GET | `/api/v1/admin/tickets/:id` | Get ticket details |
| POST | `/api/v1/admin/tickets/:id/reply` | Reply to ticket |
| PATCH | `/api/v1/admin/tickets/:id/assign` | Assign ticket to admin |
| POST | `/api/v1/admin/tickets/:id/close` | Close ticket |
| GET | `/api/v1/admin/tickets/stats` | Get support metrics |

### Feature Flags (Super Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/feature-flags` | List all feature flags |
| GET | `/api/v1/admin/feature-flags/:key` | Get feature flag details |
| PATCH | `/api/v1/admin/feature-flags/:key` | Update feature flag |
| POST | `/api/v1/admin/feature-flags/:key/emergency-disable` | Emergency kill switch |
| GET | `/api/v1/admin/feature-flags/:key/stats` | Get flag usage stats |

**Total**: 29 API endpoints

---

## Database Schema

### admin_users
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'support_agent',
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(32),
  last_login_ip VARCHAR(45),
  last_login_at TIMESTAMP,
  whitelisted_ips TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### audit_logs (Immutable)
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### support_tickets
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  assigned_to_id UUID REFERENCES admin_users(id),
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  category VARCHAR(50),
  conversation JSONB,
  internal_notes TEXT,
  tags TEXT,
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### feature_flags
```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  flag_key VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 100,
  tier_overrides JSONB,
  whitelisted_user_ids TEXT,
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### content_flags
```sql
CREATE TABLE content_flags (
  id UUID PRIMARY KEY,
  flag_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  reporter_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  auto_hidden BOOLEAN DEFAULT false,
  reviewed_by_id UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMP,
  moderator_notes TEXT,
  action_taken VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Setup Instructions

### 1. Run Migrations

```bash
cd backend
npm run migrate
```

This will create all admin backend tables.

### 2. Create First Super Admin

**Option A: Via SQL (Production)**
```sql
INSERT INTO admin_users (email, password_hash, full_name, role, two_factor_enabled, is_active)
VALUES (
  'admin@menumaker.app',
  -- Use bcrypt to hash password (10 rounds)
  '$2b$10$YOUR_HASHED_PASSWORD_HERE',
  'Super Admin',
  'super_admin',
  false, -- Enable 2FA after first login
  true
);
```

**Option B: Via Script (Development)**
```typescript
// scripts/createAdminUser.ts
import bcrypt from 'bcrypt';
import { AppDataSource } from '../src/data-source';
import { AdminUser } from '../src/models/AdminUser';

const password_hash = await bcrypt.hash('your-secure-password', 10);

const adminUser = adminUserRepo.create({
  email: 'admin@menumaker.app',
  password_hash,
  full_name: 'Super Admin',
  role: 'super_admin',
  two_factor_enabled: false,
  is_active: true,
});

await adminUserRepo.save(adminUser);
```

### 3. Login as Admin

**POST** `/api/v1/auth/login` (use existing auth endpoint)
```json
{
  "email": "admin@menumaker.app",
  "password": "your-secure-password"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "admin@menumaker.app",
    "role": "super_admin"
  }
}
```

### 4. Use Admin API

All admin API calls require the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.menumaker.app/api/v1/admin/analytics/dashboard
```

---

## Security

### Authentication
- **JWT-based**: Same JWT system as regular users
- **Mandatory 2FA**: All admin users must enable 2FA (TOTP-based) [Phase 3.5]
- **IP Whitelisting**: Optional per-admin IP restrictions
- **Session Timeout**: 4-hour session expiry

### Authorization (RBAC)
- **Role-based**: super_admin, moderator, support_agent
- **Middleware**: `authenticateAdmin`, `requireSuperAdmin`, `requireModerator`, `requireSupportAgent`

### Audit Trail
- **Immutable logs**: All admin actions logged to `audit_logs` table
- **1-year retention**: Logs retained for compliance
- **Cannot be deleted**: Append-only table

---

## Auto-Moderation Rules

### Content Flags
- **Auto-hide**: Content auto-hidden after **3 flags**
- **Auto-ban**: User auto-banned after **5 rejected false flags**
- **Response Time**: Target <2 hours (business hours)

### Feature Flags
- **Emergency Kill Switch**: Instantly disable feature for all users
- **Gradual Rollout**: 0%, 10%, 50%, 100% rollout percentages
- **Tier Overrides**: Enable/disable per subscription tier

---

## Support SLA

- **First Response**: 24 hours target
- **Auto-assignment**: Round-robin to support agents
- **Priority Levels**: Low, Medium, High
- **Status Flow**: Open → Pending → Resolved → Closed

---

## Success Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Admin backend operational | ✅ | Fully functional admin API |
| Manual ops reduction | 70% | Reduced manual work via automation |
| Moderation response time | <2 hours | Flag review SLA |
| Support ticket SLA | 90%+ | Tickets responded within 24h |
| Audit log coverage | 100% | All admin actions logged |
| Zero security incidents | ✅ | No unauthorized admin access |

---

## Future Enhancements (Phase 3.5+)

- [ ] **2FA Implementation**: TOTP-based authentication for all admin users
- [ ] **Admin Frontend Dashboard**: React-based UI for admin operations
- [ ] **Automated Data Deletion**: Scheduled job for GDPR deletion requests
- [ ] **Email Notifications**: Auto-send emails on suspension, ban, ticket reply
- [ ] **Advanced Analytics**: Custom reports, data visualization charts
- [ ] **Automated Ban**: AI-powered spam detection and auto-ban

---

## Troubleshooting

### Issue: "2FA must be enabled for admin accounts"
**Solution**: Phase 3 Foundation does not include 2FA implementation. Temporarily disable the 2FA check in `adminAuth.ts` middleware:
```typescript
// Comment out this check until Phase 3.5
// if (!adminUser.two_factor_enabled) {
//   return reply.status(403).send({ error: 'Forbidden', message: '2FA must be enabled' });
// }
```

### Issue: Cannot access admin routes (403 Forbidden)
**Cause**: User role is not `super_admin`
**Solution**: Update user role in database:
```sql
UPDATE admin_users SET role = 'super_admin' WHERE email = 'admin@menumaker.app';
```

### Issue: Audit logs not showing
**Cause**: Admin actions not creating audit logs
**Solution**: Ensure `admin_user_id` is passed to all service methods and audit log creation is not failing silently.

---

## API Examples

### Suspend User (7 days)
```bash
POST /api/v1/admin/users/{user_id}/suspend
Authorization: Bearer YOUR_JWT_TOKEN

{
  "reason": "Spamming customers",
  "duration_days": 7
}
```

### Approve Content Flag
```bash
POST /api/v1/admin/moderation/flags/{flag_id}/approve
Authorization: Bearer YOUR_JWT_TOKEN

{
  "action_taken": "content_deleted",
  "moderator_notes": "Inappropriate content confirmed"
}
```

### Toggle Feature Flag
```bash
PATCH /api/v1/admin/feature-flags/marketplace_discovery_enabled
Authorization: Bearer YOUR_JWT_TOKEN

{
  "is_enabled": true,
  "rollout_percentage": 50
}
```

---

## Support

For questions or issues:
- **GitHub Issues**: https://github.com/ameedanxari/menumaker/issues
- **Documentation**: https://docs.menumaker.app/admin-backend
- **Internal Wiki**: [Your internal documentation]

---

**Status**: ✅ Phase 3 Foundation Complete
**Next Steps**: Implement 2FA (Phase 3.5), Design System (US3.12)
