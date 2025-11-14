# GDPR Compliance Summary - MenuMaker

**Version**: 1.0
**Last Updated**: 2025-11-12
**Compliance Target**: Phase 2 (Foundation) + Phase 3 (Full Compliance)

---

## Overview

MenuMaker implements GDPR compliance in two phases:
- **Phase 2**: Foundation (cookie consent, account deletion, data retention)
- **Phase 3**: Full compliance (data portability, consent management, audit trail)

This document clarifies the **data retention policy** to resolve conflicts across specifications.

---

## Data Retention Policy (GDPR-Compliant)

### Critical Principle

**All Personally Identifiable Information (PII) is anonymized IMMEDIATELY upon account deletion request.**

The 3-year order retention applies **ONLY** to anonymized records required for legal/tax compliance in India. Users cannot be re-identified from these records.

---

## Account Deletion Workflow

### Timeline

```
Day 0: Deletion Request
    ↓
Immediate: PII Anonymization (irreversible)
    ↓
Day 0-30: Grace Period (soft delete, user can recover)
    ↓
Day 30: Hard Deletion (permanent, cannot recover)
    ↓
3 Years: Anonymized Orders Retained (tax compliance)
    ↓
7 Years: Payment Records Retained (legal requirement)
```

### Day 0: Immediate Actions (Upon Deletion Request)

**1. User Profile**
- Status: `account_status` = `'pending_deletion'`
- Soft delete: `deleted_at` = NOW()
- Scheduled deletion: `deletion_scheduled_for` = NOW() + 30 days
- Email notification sent with cancellation instructions

**2. Business Profile**
- Hidden from public menu discovery
- Slug remains reserved (prevents impersonation)
- Data intact for recovery period

**3. All Orders (CRITICAL - PII Anonymization)**

Anonymize **immediately** and **irreversibly**:

| Field | Original Value | Anonymized Value |
|-------|----------------|------------------|
| `customer_name` | "Rajesh Kumar" | `"DELETED USER"` |
| `customer_email` | "rajesh@example.com" | `"deleted+{orderId}@menumaker.app"` |
| `customer_phone` | "+91 98765 43210" | `"DELETED"` |
| `delivery_address` | "123 Main St, Bangalore" | `"DELETED"` |
| `notes` | "Extra spicy, ring bell twice" | `"DELETED"` |
| `anonymized_at` | NULL | NOW() |

**Why unique email per order?**
- Accounting systems may reference email for invoice lookups
- Format `deleted+abc123@menumaker.app` ensures uniqueness per order
- Still prevents user identification (no reverse lookup possible)

**4. Dishes & Menus**
- Unpublished (hidden from public view)
- NOT deleted (allows recovery if user returns within 30 days)
- Marked as `is_available = false`

**5. Analytics**
- User events anonymized
- Device IDs unlinked from user_id
- Aggregated metrics remain (no PII)

**6. Referrals**
- Referral code remains (to credit referrers)
- Referee name anonymized: `referee_name` → `"DELETED USER"`
- Reward status preserved (already claimed/pending)

### Day 1-30: Grace Period

**User Can Recover Account**:
- Login with original email/password
- System checks `deleted_at IS NOT NULL` and `deletion_scheduled_for > NOW()`
- Restores account:
  - `account_status` → `'active'`
  - `deleted_at` → NULL
  - `deletion_scheduled_for` → NULL
- **PII CANNOT be recovered** (already anonymized)
- Orders remain anonymous

**What Stays Deleted?**
- Order PII (anonymization is irreversible)
- User must accept that previous orders show as "DELETED USER"

### Day 30: Hard Deletion (Permanent)

**Automated Cron Job** runs daily:

```typescript
// Pseudo-code for hard deletion cron
async function hardDeleteExpiredAccounts() {
  const expiredUsers = await User.find({
    deletion_scheduled_for: LessThan(new Date()),
    deleted_at: Not(IsNull())
  });

  for (const user of expiredUsers) {
    // 1. Delete user profile
    await User.delete({ id: user.id });

    // 2. Delete business profile
    await Business.delete({ owner_id: user.id });

    // 3. Delete dishes and menus
    await Dish.delete({ business_id: user.business_id });
    await Menu.delete({ business_id: user.business_id });

    // 4. Delete notifications
    await Notification.delete({ user_id: user.id });

    // 5. Orders remain (already anonymized on Day 0)
    // NO deletion - retained for tax compliance

    // 6. Audit log
    await AuditLog.create({
      action: 'user_hard_deleted',
      target_type: 'user',
      target_id: user.id,
      details: { reason: 'GDPR deletion (30-day grace period expired)' }
    });
  }
}
```

**What Gets Deleted?**
- User entity (id, email, password_hash, etc.)
- Business entity
- Dish entities
- Menu entities
- MenuItem join records
- Notification entities
- Referral records (if referee)

**What Remains?**
- **Orders** (already anonymized) → Retained **3 years**
- **OrderItem** records (linked to anonymized orders)
- **Payout** records → Retained **indefinitely** (financial audit)
- **Payment** records → Retained **7 years** (Indian legal requirement)
- **Referral** records (if referrer) → Remain for other users' rewards

---

## Data Retention Summary Table

| Data Type | Anonymization | Grace Period | Long-Term Retention | Reason |
|-----------|---------------|--------------|---------------------|--------|
| **User Profile** | N/A (deleted) | 30 days (soft) | Deleted | GDPR right to erasure |
| **Business Profile** | N/A (deleted) | 30 days (soft) | Deleted | GDPR right to erasure |
| **Orders (PII)** | **Immediate** | N/A | **Never** (anonymized) | GDPR compliance |
| **Orders (Anonymized)** | Day 0 | N/A | **3 years** | GST/tax compliance (India) |
| **Payment Records** | Immediate | N/A | **7 years** | Section 128 Companies Act 2013 (India) |
| **Dishes/Menus** | N/A | 30 days (soft) | Deleted | GDPR right to erasure |
| **Analytics (Aggregated)** | Immediate | N/A | 2 years | No PII, business intelligence |
| **Referrals (as Referrer)** | N/A | N/A | Indefinite | Required for rewards system |
| **Referrals (as Referee)** | Name only | N/A | Indefinite (anonymized) | Reward tracking |

---

## Legal Compliance (India)

### GST Compliance
**Requirement**: Maintain records for **3 years** from due date of annual return
**Reference**: Section 36 of CGST Act, 2017
**Impact**: Orders (anonymized) must be retained for tax audits

### Companies Act Compliance
**Requirement**: Financial records retained for **7 years**
**Reference**: Section 128 of Companies Act, 2013
**Impact**: Payment records, invoices, payout records

### GDPR Compliance (EU Sellers)
**Requirement**: Right to erasure ("right to be forgotten")
**Reference**: Article 17, GDPR
**Impact**: PII must be deleted **immediately**, except where legal basis exists (e.g., tax compliance)

**Our Approach**: Anonymize PII immediately, retain anonymized records for legal compliance

---

## Implementation Details

### Database Schema Changes

**User Table** (Phase 2):
```typescript
@Column({ type: 'varchar', default: 'active' })
account_status: string; // 'active', 'suspended', 'banned', 'pending_deletion'

@Column({ type: 'timestamp', nullable: true })
deleted_at: Date; // Soft delete timestamp

@Column({ type: 'timestamp', nullable: true })
deletion_scheduled_for: Date; // Hard deletion date (deleted_at + 30 days)
```

**Order Table** (Phase 2):
```typescript
@Column({ type: 'timestamp', nullable: true })
anonymized_at: Date; // GDPR: Set when user deletes account (PII anonymized)
```

### API Endpoints

**POST /api/v1/users/me/delete-account** (Phase 2)

Request:
```json
{
  "confirm_deletion": true,
  "reason": "No longer using the service" // Optional
}
```

Response (202 Accepted):
```json
{
  "deletion_scheduled_at": "2025-11-12T10:30:00Z",
  "cancellation_deadline": "2025-12-12T10:30:00Z",
  "pii_anonymized": true,
  "recovery_possible": true,
  "recovery_instructions": "Log in before Dec 12 to cancel deletion"
}
```

**POST /api/v1/users/me/export-data** (Phase 2)

Request: (empty body)

Response (202 Accepted):
```json
{
  "request_id": "exp_abc123",
  "estimated_completion": "2025-11-12T22:30:00Z",
  "delivery_method": "email",
  "format": "JSON"
}
```

Exported data includes:
- User profile (email, created_at, etc.)
- Business profile
- All dishes created
- All menus published
- All orders received (PII included if account not deleted)
- Payout history

### Cron Jobs

**Daily: Hard Delete Expired Accounts**
```typescript
// Schedule: Every day at 2 AM UTC
// Function: hardDeleteExpiredAccounts()
// Target: Users where deletion_scheduled_for < NOW()
```

**Monthly: Purge Old Anonymized Orders**
```typescript
// Schedule: First day of each month
// Function: purgeOldOrders()
// Target: Orders where anonymized_at < NOW() - 3 years
```

**Yearly: Purge Old Payment Records**
```typescript
// Schedule: January 1 each year
// Function: purgeOldPayments()
// Target: Payment records older than 7 years
```

---

## GDPR Audit Checklist

### Phase 2: Foundation (Must Have)

- [x] **Right to Access**: `GET /users/me` returns all user data
- [x] **Right to Data Portability**: `POST /users/me/export-data` (JSON export)
- [x] **Right to Erasure**: `POST /users/me/delete-account` (30-day grace)
- [x] **Consent Management**: Cookie consent banner (analytics, marketing)
- [x] **Privacy Policy**: Auto-generated, links to GDPR rights
- [x] **Data Retention Policy**: Documented (this file)
- [x] **PII Anonymization**: Immediate on deletion request
- [x] **Grace Period**: 30 days to cancel deletion

### Phase 3: Full Compliance (Should Have)

- [ ] **Consent Audit Trail**: Log all consent changes (UserConsent entity)
- [ ] **Data Access Log**: Log admin access to PII (AuditLog entity)
- [ ] **Right to Object**: Users can object to data processing
- [ ] **Right to Rectification**: Users can update incorrect data
- [ ] **Automated Deletion**: Cron job for hard deletions (Day 30)
- [ ] **Data Breach Protocol**: Notification within 72 hours
- [ ] **DPO Contact**: Data Protection Officer email in privacy policy
- [ ] **GDPR Compliance Audit**: Third-party audit (annual)

---

## FAQ

### Q: What happens if a user deletes their account by mistake?

**A**: They have 30 days to log back in and cancel the deletion. The account will be fully restored **except** for order PII (which was anonymized on Day 0). The user will see their previous orders listed as "DELETED USER" orders.

### Q: Can we restore order PII after deletion?

**A**: No. PII anonymization is **irreversible by design** to ensure GDPR compliance. Once anonymized, there is no way to recover original customer names, emails, or addresses.

### Q: Why retain anonymized orders for 3 years?

**A**: Indian GST law (Section 36 of CGST Act, 2017) requires businesses to maintain records for 3 years from the due date of the annual return. Anonymized orders contain transaction amounts, dates, and tax information needed for audits, but no PII.

### Q: What if a user requests data export after deletion?

**A**: If within the 30-day grace period, we can provide a partial export (no order PII). After 30 days, the user no longer exists in our system, so we cannot fulfill the request. This is GDPR-compliant (Article 17(3) allows exceptions for legal obligations).

### Q: Do we need consent for retaining anonymized orders?

**A**: No. GDPR allows data retention for "compliance with a legal obligation" (Article 6(1)(c)). Anonymized orders do not contain PII, so they are not subject to erasure under Article 17.

### Q: What about customer orders (not seller orders)?

**A**: In Phase 1-3, orders are submitted by customers without accounts (guest orders). When a **seller** deletes their account, **their received orders** are anonymized. Customer PII is anonymized immediately. In Phase 4+ when customer accounts are introduced, the same deletion policy applies.

---

## Testing Checklist

Before launching account deletion feature:

- [ ] **Unit Test**: Anonymization function correctly updates all PII fields
- [ ] **Integration Test**: Full deletion workflow (request → anonymize → soft delete → hard delete)
- [ ] **Edge Case**: User with 0 orders
- [ ] **Edge Case**: User with 1000+ orders (performance test)
- [ ] **Edge Case**: User cancels deletion within 30 days
- [ ] **Edge Case**: User tries to cancel after 30 days (should fail)
- [ ] **Cron Test**: Hard deletion cron job runs successfully
- [ ] **Cron Test**: Old orders purge cron job (3+ years old)
- [ ] **Email Test**: Deletion confirmation email sent
- [ ] **Email Test**: Reminder email sent on Day 7, Day 14, Day 27
- [ ] **Audit Test**: All deletions logged in AuditLog
- [ ] **Data Export Test**: Export completes within 12 hours
- [ ] **Rollback Test**: Cancel deletion restores account (except PII)

---

## References

- [GDPR Full Text](https://gdpr-info.eu/)
- [CGST Act 2017 (India)](https://cbic-gst.gov.in/cgst-act.html)
- [Companies Act 2013 (India)](https://www.mca.gov.in/Ministry/pdf/CompaniesAct2013.pdf)
- [data-model.md](./data-model.md) - Database schema
- [COMPREHENSIVE-NEW-REQUIREMENTS.md](../COMPREHENSIVE-NEW-REQUIREMENTS.md) - GDPR features
- [phase-2-spec.md](./phase-2-spec.md) - Phase 2 GDPR implementation

---

**Document Status**: ✅ Finalized
**Next Review**: Before Phase 2 development starts
**Owner**: Compliance Team + Backend Team
