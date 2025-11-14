# Phase 3: Admin Backend Platform (US3.10)

## Overview

The Admin Backend is a web-based platform management interface that enables MenuMaker operations team to manage sellers, moderate content, handle support tickets, monitor platform health, and configure system settings. This is **critical infrastructure** for scaling from 500 to 5,000+ sellers.

## Goals

1. **Operational Efficiency**: Reduce manual support work by 70% through self-service admin tools
2. **Content Safety**: Respond to content moderation flags within 2 hours (business hours)
3. **Platform Health**: Monitor system metrics in real-time (uptime, errors, GMV)
4. **User Management**: Suspend/ban accounts, resolve disputes, manage refunds
5. **Data-Driven Decisions**: Access platform-wide analytics for product/business strategy

## User Story (US3.10)

**As an** admin/operations team member
**I want to** manage the MenuMaker platform through a dedicated admin portal
**So that** I can ensure platform health, user safety, and business growth

### Acceptance Criteria

✅ **AC1**: Admin can view and search all sellers/customers with filters (status, date, GMV)
✅ **AC2**: Admin can suspend/ban seller accounts with reason tracking
✅ **AC3**: Admin can view content moderation queue and approve/reject flagged content
✅ **AC4**: Admin can view platform-wide analytics dashboard (GMV, active sellers, orders)
✅ **AC5**: Admin can manage support tickets (view, assign, respond, close)
✅ **AC6**: Admin can configure feature flags (enable/disable features per tier)
✅ **AC7**: Admin can view audit logs of all admin actions
✅ **AC8**: Admin access is role-based (Super Admin, Moderator, Support Agent)

## Admin Portal Architecture

### Tech Stack

**Frontend**: React 18 + TypeScript + TanStack Query
**UI Library**: shadcn/ui (Tailwind CSS components)
**State Management**: Zustand
**Routing**: React Router v6
**Charts**: Recharts
**Tables**: TanStack Table

**Backend**: Same Node.js/Fastify API
**Authentication**: Separate admin JWT tokens with elevated permissions
**Authorization**: Role-based access control (RBAC)

**Deployment**: Same Heroku infrastructure as main app
**URL**: `https://admin.menumaker.com` (separate subdomain)

### Security Architecture

```
Admin User Login
    ↓
Email + Password + 2FA (required)
    ↓
Admin JWT Token (expires in 4 hours)
    ↓
RBAC Check (role: super_admin | moderator | support_agent)
    ↓
Audit Log (all actions logged)
    ↓
Action Executed
```

**Key Security Measures**:
- 2FA mandatory for all admin users (Google Authenticator)
- Session timeout: 4 hours (vs 30 days for regular users)
- IP whitelist: Only allow access from office IPs (configurable)
- Audit trail: Log every admin action (who, what, when)
- Password rotation: Required every 90 days

## Admin Roles & Permissions

### Role Matrix

| Feature | Super Admin | Moderator | Support Agent |
|---------|-------------|-----------|---------------|
| View all users | ✅ | ✅ | ✅ |
| Suspend/ban users | ✅ | ✅ | ❌ |
| Delete users | ✅ | ❌ | ❌ |
| Moderate content (approve/reject flags) | ✅ | ✅ | ❌ |
| View support tickets | ✅ | ✅ | ✅ |
| Assign tickets | ✅ | ✅ | ✅ |
| Close tickets | ✅ | ✅ | ✅ |
| View analytics dashboard | ✅ | ✅ | ✅ (limited) |
| Configure feature flags | ✅ | ❌ | ❌ |
| Manage admin users | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Issue refunds | ✅ | ❌ | ❌ |
| Export data | ✅ | ❌ | ❌ |

## Core Features

### 1. User Management

#### Seller Management

**List View**:
```
┌────────────────────────────────────────────────────────────┐
│  Sellers                                    [Export CSV]    │
├────────────────────────────────────────────────────────────┤
│  Search: [________________]  Filters: [Status ▼] [Date ▼]  │
│                                                             │
│  Name          Business      Status    GMV      Joined     │
│  ────────────────────────────────────────────────────────  │
│  Priya Sharma  Spice Kitchen Active    ₹45K    Nov 10     │
│  Raj Kumar     Raj's Dhaba   Suspended ₹12K    Nov 8      │
│  Amit Patel    Cloud Kitchen Active    ₹89K    Oct 25     │
│                                                             │
│  Showing 1-20 of 1,234                     [1] 2 3 ... 62  │
└────────────────────────────────────────────────────────────┘
```

**Filters**:
- Status: Active, Suspended, Banned, Pending Verification
- Subscription: Free, Pro, Business
- GMV Range: < Rs. 10K, Rs. 10-50K, > Rs. 50K
- Join Date: Last 7 days, Last 30 days, Custom range
- Location: City dropdown

**Seller Detail View**:
```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Sellers                                          │
├────────────────────────────────────────────────────────────┤
│  Priya Sharma (priya@example.com)                          │
│  Status: Active  •  Joined: Nov 10, 2025                   │
│                                                             │
│  Business: Spice Kitchen                                   │
│  Phone: +91 98765 43210                                    │
│  Location: Bangalore, Karnataka                            │
│  Subscription: Pro (expires Dec 10, 2025)                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Quick Stats                                          │  │
│  │ Total Orders: 45  •  GMV: ₹45,000  •  Dishes: 12    │  │
│  │ Avg Order Value: ₹1,000  •  Repeat Rate: 35%        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Tabs: [Overview] [Orders] [Reviews] [Activity Log]        │
│                                                             │
│  Recent Orders:                                             │
│  #ORD-123 - ₹1,200 - Nov 15, 2025 - Completed             │
│  #ORD-122 - ₹800 - Nov 14, 2025 - Completed               │
│                                                             │
│  Actions:                                                   │
│  [Send Message] [Suspend Account] [Ban Account]            │
│  [Issue Refund] [Upgrade to Pro] [View Login History]      │
└────────────────────────────────────────────────────────────┘
```

**Actions**:

1. **Suspend Account**
   ```
   Reason: [Spam / Fraud / Policy Violation / Other]
   Duration: [7 days / 30 days / Indefinite]
   Notes: [_________________________________]
   [Suspend] [Cancel]
   ```

2. **Ban Account** (permanent)
   ```
   ⚠️ This action cannot be undone. The user will be permanently banned.

   Reason: [Fraud / Abuse / Legal / Other]
   Notes: [_________________________________]
   Ban Email: ☑ Prevent re-signup with this email
   Ban Phone: ☑ Prevent re-signup with this phone
   Ban IP: ☐ Block this IP address

   [Ban Account] [Cancel]
   ```

3. **Send Message**
   ```
   To: priya@example.com
   Subject: [_________________________________]
   Message: [_________________________________]
   [Send] [Cancel]
   ```

#### Customer Management (Phase 3.5+)

Similar to seller management but focused on customer accounts (when customer login feature is added).

### 2. Content Moderation Queue

**Flagged Content Dashboard**:
```
┌────────────────────────────────────────────────────────────┐
│  Content Moderation                        🔔 12 Pending    │
├────────────────────────────────────────────────────────────┤
│  Filters: [All] [Reviews] [Menus] [Dishes] [Images]        │
│           [Pending] [Approved] [Rejected]                   │
│                                                             │
│  Type    Content          Flags  Reason      Reported      │
│  ─────────────────────────────────────────────────────────  │
│  Review  "Worst food..."  3      Offensive   2 hrs ago     │
│  Dish    "Special Item"   5      Spam        5 hrs ago     │
│  Image   [dish.jpg]       2      Inappropriate 1 day ago   │
│                                                             │
│  Showing 1-20 of 45                        [1] 2 3          │
└────────────────────────────────────────────────────────────┘
```

**Flag Detail View**:
```
┌────────────────────────────────────────────────────────────┐
│  Review Flag Detail                                         │
├────────────────────────────────────────────────────────────┤
│  Review by: Raj Kumar                                       │
│  Business: Spice Kitchen (Priya Sharma)                     │
│  Posted: Nov 15, 2025 at 2:30 PM                           │
│                                                             │
│  Review Text:                                               │
│  "Worst food ever! Total waste of money. Don't order!"     │
│                                                             │
│  ⚠️ Flagged 3 times:                                        │
│  • Nov 15, 3:00 PM - Offensive language (by user_123)      │
│  • Nov 15, 4:15 PM - Spam (by user_456)                    │
│  • Nov 15, 5:30 PM - Offensive language (by user_789)      │
│                                                             │
│  Auto-Actions Taken:                                        │
│  ✓ Review hidden from public view (3+ flags)               │
│                                                             │
│  Moderator Actions:                                         │
│  [Approve (restore review)] [Reject (delete permanently)]   │
│  [Contact Reviewer] [Contact Seller]                        │
│                                                             │
│  Internal Notes:                                            │
│  [_____________________________________________]            │
│  [Save Notes]                                               │
└────────────────────────────────────────────────────────────┘
```

**Moderation Actions**:
- **Approve**: Restore content, unblock from public view
- **Reject**: Permanently delete content
- **Warn User**: Send warning email to content creator
- **Ban User**: Escalate to user ban (for severe violations)

**Auto-Moderation Rules** (configurable):
- Auto-hide content with 3+ flags (pending manual review)
- Auto-ban users with 5+ rejected flags
- Keyword filters (profanity, spam patterns)

### 3. Platform Analytics Dashboard

**Main Dashboard**:
```
┌────────────────────────────────────────────────────────────┐
│  Platform Overview                    Last 30 Days ▼       │
├────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  4,234   │ │  ₹12.5L  │ │  8,901   │ │  99.2%   │     │
│  │  Sellers │ │    GMV   │ │  Orders  │ │  Uptime  │     │
│  │  ↑ 12%   │ │  ↑ 45%   │ │  ↑ 23%   │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  GMV Trend (Last 30 Days)                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [Line chart showing daily GMV]                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  New Sellers (Daily)                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [Bar chart showing daily signups]                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Top Sellers (by GMV)              Top Cities              │
│  1. Spice Kitchen - ₹89K           1. Bangalore - 1,234    │
│  2. Raj's Dhaba - ₹67K             2. Mumbai - 987         │
│  3. Cloud Kitchen - ₹56K           3. Delhi - 756          │
└────────────────────────────────────────────────────────────┘
```

**Analytics Sections**:

1. **Business Metrics**
   - Total sellers (active/inactive breakdown)
   - GMV (Gross Merchandise Value) trend
   - Total orders, average order value
   - Revenue (subscription + payment processing fees)

2. **User Engagement**
   - Daily active sellers (DAU)
   - Weekly active sellers (WAU)
   - Churn rate
   - Retention cohorts (7-day, 30-day)

3. **Content Metrics**
   - Total dishes created
   - Total menus published
   - Avg dishes per seller
   - Content moderation stats (flags, approvals, rejections)

4. **System Health**
   - API uptime %
   - Error rate (5xx responses)
   - Average API latency (p50, p95, p99)
   - Database connection pool usage

5. **Financials**
   - MRR (Monthly Recurring Revenue) from subscriptions
   - Churn revenue
   - LTV (Lifetime Value) per seller
   - CAC (Customer Acquisition Cost)

### 4. Support Ticket System

**Ticket List**:
```
┌────────────────────────────────────────────────────────────┐
│  Support Tickets                       🔔 8 Unassigned     │
├────────────────────────────────────────────────────────────┤
│  Filters: [Open] [In Progress] [Closed] [All]              │
│           [Unassigned] [My Tickets]                         │
│                                                             │
│  ID      Subject         From           Status    Assigned  │
│  ─────────────────────────────────────────────────────────  │
│  #501    Can't login     Priya Sharma   Open      -         │
│  #500    Payment issue   Raj Kumar      In Prog   @amit     │
│  #499    Menu not shown  Deepa M        Open      @priya    │
│                                                             │
│  Showing 1-20 of 123                       [1] 2 3 ... 7    │
└────────────────────────────────────────────────────────────┘
```

**Ticket Detail**:
```
┌────────────────────────────────────────────────────────────┐
│  Ticket #501: Can't login                                   │
│  From: Priya Sharma (priya@example.com)                     │
│  Created: Nov 15, 2025 at 10:30 AM                         │
│  Status: Open  •  Priority: High  •  Assigned: Unassigned  │
├────────────────────────────────────────────────────────────┤
│  Conversation:                                              │
│                                                             │
│  [Priya Sharma] Nov 15, 10:30 AM                           │
│  "I can't log in to my account. I keep getting 'Invalid    │
│   password' error even though I'm sure my password is      │
│   correct."                                                 │
│                                                             │
│  [Admin Response] ________________________________          │
│  [Send Reply] [Close Ticket] [Assign to Me]                │
│                                                             │
│  Actions:                                                   │
│  [View User Account] [Reset Password] [Check Login Logs]   │
│  [Escalate to Engineering]                                  │
│                                                             │
│  Internal Notes (not visible to user):                      │
│  [_______________________________________________]          │
│  [Save Note]                                                │
└────────────────────────────────────────────────────────────┘
```

**Ticket Actions**:
- Assign to self or other agent
- Change status (Open → In Progress → Closed)
- Set priority (Low, Medium, High, Urgent)
- Add internal notes
- Send canned responses (common answers)

**Auto-Ticket Creation**:
- User submits "Contact Support" form → Creates ticket
- Failed payment → Auto-creates ticket
- Flagged content (if seller appeals) → Creates ticket

### 5. Feature Flags Management

**Feature Flags Dashboard**:
```
┌────────────────────────────────────────────────────────────┐
│  Feature Flags                                              │
├────────────────────────────────────────────────────────────┤
│  Feature                     Free    Pro     Business       │
│  ─────────────────────────────────────────────────────────  │
│  WhatsApp Notifications      ❌      ✅      ✅             │
│  OCR Menu Import             ❌      ✅      ✅             │
│  Advanced Analytics          ❌      ❌      ✅             │
│  Multi-Location              ❌      ❌      ✅             │
│  Custom Branding             ❌      ✅      ✅             │
│  Priority Support            ❌      ✅      ✅             │
│                                                             │
│  [Add New Flag] [Export Configuration]                      │
└────────────────────────────────────────────────────────────┘
```

**Edit Feature Flag**:
```
┌────────────────────────────────────────────────────────────┐
│  Edit Feature: WhatsApp Notifications                       │
├────────────────────────────────────────────────────────────┤
│  Flag Key: whatsapp_notifications                           │
│  Description: Send order notifications via WhatsApp         │
│                                                             │
│  Enable for:                                                │
│  ☐ Free Tier                                               │
│  ☑ Pro Tier                                                │
│  ☑ Business Tier                                           │
│                                                             │
│  Rollout Strategy:                                          │
│  ⚪ All users immediately                                   │
│  ⚫ Gradual rollout: [50]% of users                        │
│  ⚪ Specific users: [user_id_1, user_id_2, ...]            │
│                                                             │
│  [Save] [Cancel]                                            │
└────────────────────────────────────────────────────────────┘
```

### 6. Audit Log

**Audit Log View**:
```
┌────────────────────────────────────────────────────────────┐
│  Audit Log                           [Export CSV]           │
├────────────────────────────────────────────────────────────┤
│  Filters: [Admin User ▼] [Action Type ▼] [Date Range ▼]    │
│                                                             │
│  When              Who        Action          Details       │
│  ─────────────────────────────────────────────────────────  │
│  Nov 15, 2:30 PM  @amit      Banned user     user_123      │
│  Nov 15, 1:15 PM  @priya     Suspended user  user_456 (7d) │
│  Nov 15, 11:00 AM @amit      Approved flag   flag_789      │
│  Nov 14, 4:30 PM  @superadm  Created admin   @newmoderator │
│                                                             │
│  Showing 1-50 of 1,234                     [1] 2 3 ... 25   │
└────────────────────────────────────────────────────────────┘
```

**Tracked Actions**:
- User management (suspend, ban, delete)
- Content moderation (approve, reject flags)
- Support tickets (assign, close)
- Feature flag changes
- Admin user creation/deletion
- Data exports
- Configuration changes

**Log Entry Detail**:
```json
{
  "id": "audit_123",
  "timestamp": "2025-11-15T14:30:00Z",
  "admin_user_id": "admin_456",
  "admin_email": "amit@menumaker.com",
  "action": "ban_user",
  "target_type": "user",
  "target_id": "user_123",
  "details": {
    "reason": "fraud",
    "notes": "Multiple fake accounts detected",
    "ban_email": true,
    "ban_phone": true,
    "ban_ip": false
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### 7. System Configuration

**Settings**:
```
┌────────────────────────────────────────────────────────────┐
│  System Configuration                                       │
├────────────────────────────────────────────────────────────┤
│  General                                                    │
│  Platform Name: [MenuMaker_______________]                 │
│  Support Email: [support@menumaker.com___]                 │
│  Maintenance Mode: ☐ Enable (shows "down for maintenance") │
│                                                             │
│  User Settings                                              │
│  Allow Signups: ☑ Enable new user signups                 │
│  Email Verification Required: ☑ Yes                        │
│  Min Password Length: [8] characters                       │
│                                                             │
│  Content Moderation                                         │
│  Auto-hide threshold: [3] flags                            │
│  Auto-ban threshold: [5] rejected flags                    │
│  Profanity filter: ☑ Enable                                │
│                                                             │
│  Payment Settings                                           │
│  Razorpay API Key: [rzp_live_***************]              │
│  Stripe API Key: [sk_live_***************]                 │
│  Platform Fee: [5]%                                        │
│                                                             │
│  [Save Changes] [Reset to Defaults]                         │
└────────────────────────────────────────────────────────────┘
```

## Data Model

### AdminUser Entity

```typescript
@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500 })
  password_hash: string;

  @Column({ type: 'varchar', length: 255 })
  full_name: string;

  @Column({ type: 'varchar', default: 'support_agent' })
  // 'super_admin' | 'moderator' | 'support_agent'
  role: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  two_factor_secret: string; // For 2FA (TOTP)

  @Column({ type: 'boolean', default: false })
  two_factor_enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  last_login_ip: string;

  @Column({ type: 'timestamp', nullable: true })
  password_changed_at: Date; // Track password rotation

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by_admin_id: string; // Which admin created this account

  @OneToMany(() => AuditLog, log => log.admin_user)
  audit_logs: AuditLog[];
}
```

### AuditLog Entity

```typescript
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AdminUser)
  admin_user: AdminUser;

  @Column({ type: 'uuid' })
  admin_user_id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string; // 'ban_user', 'approve_flag', 'close_ticket', etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_type: string; // 'user', 'flag', 'ticket', 'feature_flag', etc.

  @Column({ type: 'uuid', nullable: true })
  target_id: string; // ID of affected resource

  @Column({ type: 'jsonb', nullable: true })
  details: object; // Additional context (reason, notes, etc.)

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Indexes**: (admin_user_id, created_at), (action), (target_type, target_id)

### SupportTicket Entity

```typescript
@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string; // Initial message

  @Column({ type: 'varchar', default: 'open' })
  // 'open' | 'in_progress' | 'waiting_on_customer' | 'closed'
  status: string;

  @Column({ type: 'varchar', default: 'medium' })
  // 'low' | 'medium' | 'high' | 'urgent'
  priority: string;

  @ManyToOne(() => User) // User who created ticket
  requester: User;

  @Column({ type: 'uuid' })
  requester_id: string;

  @Column({ type: 'varchar', length: 255 })
  requester_email: string;

  @ManyToOne(() => AdminUser, { nullable: true }) // Assigned admin
  assigned_to: AdminUser;

  @Column({ type: 'uuid', nullable: true })
  assigned_to_id: string;

  @Column({ type: 'timestamp', nullable: true })
  first_response_at: Date; // SLA tracking

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @OneToMany(() => TicketMessage, msg => msg.ticket)
  messages: TicketMessage[];
}
```

### TicketMessage Entity

```typescript
@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SupportTicket, ticket => ticket.messages, { onDelete: 'CASCADE' })
  ticket: SupportTicket;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  is_internal_note: boolean; // True if admin-only note

  @Column({ type: 'varchar', length: 50 })
  sender_type: string; // 'admin' | 'user'

  @Column({ type: 'uuid', nullable: true })
  sender_admin_id: string; // If sent by admin

  @Column({ type: 'uuid', nullable: true })
  sender_user_id: string; // If sent by user

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

### FeatureFlag Entity

```typescript
@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  flag_key: string; // e.g., 'whatsapp_notifications'

  @Column({ type: 'varchar', length: 255 })
  name: string; // Human-readable name

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  enabled_for_free: boolean;

  @Column({ type: 'boolean', default: false })
  enabled_for_pro: boolean;

  @Column({ type: 'boolean', default: false })
  enabled_for_business: boolean;

  @Column({ type: 'integer', default: 100 })
  rollout_percentage: number; // 0-100 (for gradual rollouts)

  @Column({ type: 'simple-array', nullable: true })
  enabled_for_user_ids: string[]; // Specific user whitelist

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}
```

## API Endpoints

### Admin Authentication

#### POST /api/v1/admin/auth/login
**Request**:
```json
{
  "email": "amit@menumaker.com",
  "password": "SecureAdminPass123",
  "totp_code": "123456"
}
```

**Response**:
```json
{
  "token": "admin_jwt_token...",
  "admin_user": {
    "id": "admin_123",
    "email": "amit@menumaker.com",
    "full_name": "Amit Kumar",
    "role": "moderator"
  }
}
```

### User Management

#### GET /api/v1/admin/users
**Query**: `?status=active&subscription=pro&limit=20&offset=0`

**Response**:
```json
{
  "data": [
    {
      "id": "user_123",
      "email": "pri***@example.com",
      "full_name": "Priya Sharma",
      "phone": "***3210",
      "status": "active",
      "subscription_tier": "pro",
      "business": {
        "id": "biz_456",
        "name": "Spice Kitchen",
        "gmv_cents": 4500000
      },
      "created_at": "2025-11-10T10:00:00Z"
    }
  ],
  "meta": { "total": 1234, "limit": 20, "offset": 0 }
}
```

#### PATCH /api/v1/admin/users/{id}/suspend
**Request**:
```json
{
  "reason": "spam",
  "duration_days": 7,
  "notes": "Multiple spam reports"
}
```

#### POST /api/v1/admin/users/{id}/ban
**Request**:
```json
{
  "reason": "fraud",
  "notes": "Fake accounts detected",
  "ban_email": true,
  "ban_phone": true,
  "ban_ip": false
}
```

### Content Moderation

#### GET /api/v1/admin/flags
**Query**: `?status=pending&type=review&limit=20`

**Response**:
```json
{
  "data": [
    {
      "id": "flag_123",
      "flag_type": "review",
      "target_id": "review_456",
      "flag_count": 3,
      "reasons": ["offensive", "offensive", "spam"],
      "status": "pending",
      "auto_hidden": true,
      "created_at": "2025-11-15T14:00:00Z"
    }
  ]
}
```

#### PATCH /api/v1/admin/flags/{id}/approve
**Response**: `{ "success": true, "message": "Content approved and restored" }`

#### PATCH /api/v1/admin/flags/{id}/reject
**Request**:
```json
{
  "action": "delete_content",
  "warn_user": true,
  "ban_user": false
}
```

### Analytics

#### GET /api/v1/admin/analytics/dashboard
**Query**: `?period=30d`

**Response**:
```json
{
  "total_sellers": 4234,
  "active_sellers": 3890,
  "gmv_cents": 1250000000,
  "total_orders": 8901,
  "uptime_percentage": 99.2,
  "trends": {
    "sellers_growth": 12,
    "gmv_growth": 45,
    "orders_growth": 23
  }
}
```

### Support Tickets

#### GET /api/v1/admin/tickets
**Query**: `?status=open&assigned_to=me&limit=20`

#### POST /api/v1/admin/tickets/{id}/messages
**Request**:
```json
{
  "message": "Hi Priya, I've reset your password...",
  "is_internal_note": false
}
```

#### PATCH /api/v1/admin/tickets/{id}/assign
**Request**: `{ "assigned_to_id": "admin_456" }`

### Audit Logs

#### GET /api/v1/admin/audit-logs
**Query**: `?admin_user_id=admin_123&action=ban_user&from=2025-11-01&to=2025-11-30`

## Security Measures

### 1. IP Whitelisting

```typescript
const ALLOWED_ADMIN_IPS = [
  '192.168.1.100', // Office IP
  '103.21.244.0/22', // VPN range
];

function isAdminIPAllowed(ip: string): boolean {
  return ALLOWED_ADMIN_IPS.some(range => ipInRange(ip, range));
}
```

### 2. Two-Factor Authentication (2FA)

**Setup Flow**:
1. Admin enables 2FA in settings
2. System generates TOTP secret
3. Display QR code (Google Authenticator compatible)
4. Admin scans QR code, enters verification code
5. 2FA enabled, required on all future logins

**Implementation**:
```typescript
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

// Generate secret
const secret = speakeasy.generateSecret({
  name: 'MenuMaker Admin (amit@menumaker.com)'
});

// Generate QR code
const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

// Verify TOTP code
const verified = speakeasy.totp.verify({
  secret: admin.two_factor_secret,
  encoding: 'base32',
  token: req.body.totp_code,
  window: 2 // Allow 2 time steps before/after
});
```

### 3. Password Rotation

**Policy**: Admins must change password every 90 days

```typescript
const DAYS_UNTIL_PASSWORD_EXPIRY = 90;

async function checkPasswordExpiry(adminUser: AdminUser) {
  const daysSinceChange = daysBetween(
    adminUser.password_changed_at,
    new Date()
  );

  if (daysSinceChange > DAYS_UNTIL_PASSWORD_EXPIRY) {
    throw new Error('Password expired. Please reset your password.');
  }
}
```

## Testing

### Unit Tests

```typescript
describe('Admin User Management', () => {
  it('suspends user with audit log entry', async () => {
    const admin = await createAdminUser('moderator');
    const user = await createUser();

    await request(app)
      .patch(`/api/v1/admin/users/${user.id}/suspend`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'spam', duration_days: 7 })
      .expect(200);

    const suspendedUser = await User.findOne({ id: user.id });
    expect(suspendedUser.status).toBe('suspended');

    const auditLog = await AuditLog.findOne({
      admin_user_id: admin.id,
      action: 'suspend_user',
      target_id: user.id
    });
    expect(auditLog).toBeDefined();
  });
});
```

## Future Enhancements (Phase 4+)

1. **Advanced Analytics**
   - Cohort analysis (retention by signup month)
   - Revenue forecasting
   - Churn prediction ML model

2. **Bulk Operations**
   - Bulk suspend users (CSV upload)
   - Bulk send emails
   - Bulk refunds

3. **Workflow Automation**
   - Auto-assign tickets based on keywords
   - Auto-escalate high-priority tickets
   - Scheduled reports (email weekly summary)

4. **Mobile Admin App**
   - iOS/Android app for on-the-go moderation
   - Push notifications for urgent flags/tickets

## Success Metrics (Phase 3 Target)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content Moderation Response Time | <2 hours (business hours) | Avg time from flag to resolution |
| Support Ticket Resolution Time | <24 hours | Avg time from creation to closed |
| Admin Tool Usage | 80% of ops tasks via admin portal | Manual interventions vs admin actions |
| Operational Efficiency | 70% reduction in manual work | Time spent on support vs Phase 2 |
| Platform Uptime Visibility | 99.5% tracked | Real-time dashboard monitoring |

---

**Status**: ✅ Ready for Implementation (Phase 3 - Month 6-8)
**Owner**: Full-Stack Team + DevOps
**Effort**: 20-25 days
**Dependencies**: Phase 1 & 2 complete, RBAC system, audit logging
