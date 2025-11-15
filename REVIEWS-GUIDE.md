# MenuMaker Review & Complaint Workflow Guide

**Phase 3: Review & Complaint Workflow (US3.5)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker enables customers to leave reviews and ratings for sellers after order completion, with built-in moderation workflow and complaint handling for low ratings.

### Key Features

✅ **Customer Reviews**: Rate sellers 1-5 stars with optional text and photos
✅ **24-Hour Moderation**: Sellers review pending reviews before public display
✅ **Complaint Workflow**: Auto-flag ratings < 3 stars for immediate seller notification
✅ **Seller Responses**: Sellers can publicly respond to reviews
✅ **Review Metrics**: Average rating, review count, rating distribution
✅ **Spam Prevention**: 1 review per customer per seller per week
✅ **Verified Purchases**: Only customers with completed orders can review

---

## Review Submission

### 1. Submit a Review

**Endpoint**: `POST /api/v1/reviews`

**Authentication**: Required (customer must own the order)

**Request**:
```json
{
  "order_id": "order-uuid",
  "rating": 5,
  "review_text": "Excellent food and service!",
  "photo_urls": [
    "https://storage.example.com/review-photo-1.jpg",
    "https://storage.example.com/review-photo-2.jpg"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid",
      "order_id": "order-uuid",
      "business_id": "business-uuid",
      "customer_id": "customer-uuid",
      "rating": 5,
      "review_text": "Excellent food and service!",
      "photo_urls": ["..."],
      "status": "pending",
      "is_complaint": false,
      "auto_approve_at": "2025-11-16T14:30:00Z",
      "is_public": false,
      "created_at": "2025-11-15T14:30:00Z"
    }
  },
  "message": "Review submitted successfully"
}
```

**Validation Rules**:
- **Rating**: Required, must be 1-5
- **Review Text**: Optional, max 500 characters
- **Photos**: Optional, max 3 photos
- **Order**: Must be completed
- **Ownership**: Customer must own the order
- **Uniqueness**: 1 review per order
- **Spam Prevention**: Max 1 review per seller per week

**Complaint Auto-Flagging**:
- If `rating < 3`: Automatically marked as complaint
- Seller notified immediately via email
- `is_complaint = true`, `complaint_status = 'open'`

---

## Moderation Workflow

### 24-Hour Seller Review Window

**Timeline**:
1. **T+0**: Customer submits review → `status = 'pending'`
2. **T+0 to T+24h**: Seller can moderate (approve or request removal)
3. **T+24h**: Auto-approved if seller doesn't moderate → `status = 'approved'`, `is_public = true`

### 2. Get Pending Reviews (Seller)

**Endpoint**: `GET /api/v1/reviews/pending/business/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid",
        "order_id": "order-uuid",
        "rating": 4,
        "review_text": "Good food but delivery was late",
        "status": "pending",
        "auto_approve_at": "2025-11-16T14:30:00Z",
        "created_at": "2025-11-15T14:30:00Z"
      }
    ]
  }
}
```

### 3. Moderate Review (Seller)

**Endpoint**: `PUT /api/v1/reviews/:id/moderate`

**Authentication**: Required (seller must own business)

**Approve Review**:
```json
{
  "action": "approve"
}
```

**Request Removal**:
```json
{
  "action": "request_removal",
  "reason": "Review contains offensive language"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid",
      "status": "approved",  // or "rejected"
      "approved_at": "2025-11-15T16:00:00Z",
      "is_public": true
    }
  },
  "message": "Review approved"
}
```

**Actions**:
- **approve**: Review becomes public immediately
- **request_removal**: Submitted to admin for review (future: admin moderation)

**Errors**:
- `400 MODERATION_WINDOW_EXPIRED`: 24-hour window passed
- `400 INVALID_STATUS`: Review already moderated

---

## Seller Responses

### 4. Add Seller Response

**Endpoint**: `POST /api/v1/reviews/:id/response`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "response_text": "Thank you for your feedback! We appreciate your business and will work on improving delivery times.",
  "responder_name": "Restaurant Owner"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": {
      "id": "response-uuid",
      "review_id": "review-uuid",
      "response_text": "Thank you for your feedback!...",
      "responder_name": "Restaurant Owner",
      "is_public": true,
      "created_at": "2025-11-15T17:00:00Z"
    }
  },
  "message": "Response added successfully"
}
```

**Rules**:
- Can only respond to **approved public reviews**
- Max 500 characters
- **One response per review** (seller can't spam)
- Response is public by default

---

## Complaint Workflow

### Auto-Flagging (Rating < 3)

When a customer submits a review with `rating < 3`:
1. `is_complaint = true`
2. `complaint_status = 'open'`
3. Seller notified immediately via email
4. Seller can update complaint status

### 5. Update Complaint Status

**Endpoint**: `PUT /api/v1/reviews/:id/complaint`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "status": "in_progress"  // or "resolved" or "escalated"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid",
      "is_complaint": true,
      "complaint_status": "in_progress",
      "seller_notified_at": "2025-11-15T14:30:00Z"
    }
  },
  "message": "Complaint status updated successfully"
}
```

**Complaint Statuses**:
- **open**: Complaint not resolved (initial state)
- **in_progress**: Seller and customer communicating
- **resolved**: Issue resolved to customer's satisfaction
- **escalated**: Escalated to admin/support

**Resolution Process**:
1. Seller receives complaint notification
2. Seller contacts customer via email/phone
3. Seller updates status to `in_progress`
4. After resolution, seller updates to `resolved`
5. If unresolved, escalate to `escalated` for admin review

---

## Fetching Reviews

### 6. Get Business Reviews (Public)

**Endpoint**: `GET /api/v1/reviews/business/:businessId`

**Authentication**: Optional (required for private reviews)

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)
- `includePrivate` (optional): Include non-public reviews (seller only)
- `limit` (optional): Number of reviews (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid",
        "rating": 5,
        "review_text": "Amazing food!",
        "photo_urls": [],
        "customer_name": "John Doe",
        "is_verified_purchase": true,
        "has_seller_response": true,
        "created_at": "2025-11-10T12:00:00Z",
        "responses": [
          {
            "response_text": "Thank you!",
            "responder_name": "Restaurant Owner",
            "created_at": "2025-11-10T14:00:00Z"
          }
        ]
      }
    ],
    "total": 50,
    "limit": 50,
    "offset": 0
  }
}
```

### 7. Get Review Metrics

**Endpoint**: `GET /api/v1/reviews/metrics/business/:businessId`

**Authentication**: Not required (public data)

**Response**:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "average_rating": 4.5,
      "total_reviews": 150,
      "rating_distribution": {
        "1": 5,
        "2": 10,
        "3": 15,
        "4": 50,
        "5": 70
      },
      "recent_reviews": [
        // Last 5 reviews
      ],
      "complaints_count": 15,
      "response_rate": 85  // Percentage
    }
  }
}
```

**Metrics Breakdown**:
- **average_rating**: Average of all approved public reviews (1 decimal)
- **total_reviews**: Count of approved public reviews
- **rating_distribution**: Count of reviews per rating (1-5)
- **recent_reviews**: Last 5 reviews
- **complaints_count**: Count of reviews with `rating < 3`
- **response_rate**: % of reviews with seller response

### 8. Get Review Trends

**Endpoint**: `GET /api/v1/reviews/trends/business/:businessId`

**Query Parameters**:
- `startDate` (required): ISO date (e.g., `2025-01-01`)
- `endDate` (required): ISO date (e.g., `2025-12-31`)

**Response**:
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "month": "2025-10",
        "average_rating": 4.3,
        "review_count": 20
      },
      {
        "month": "2025-11",
        "average_rating": 4.6,
        "review_count": 30
      }
    ]
  }
}
```

**Use Case**: Track rating trends over time to identify improvements or issues

---

## Customer Review Management

### 9. Get Customer's Review for Order

**Endpoint**: `GET /api/v1/reviews/order/:orderId`

**Authentication**: Required (customer must own order)

**Response**:
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid",
      "rating": 5,
      "review_text": "Great service!",
      "status": "approved",
      "created_at": "2025-11-15T14:30:00Z"
    }
  }
}
```

### 10. Check if Customer Can Review

**Endpoint**: `GET /api/v1/reviews/order/:orderId/can-review`

**Authentication**: Required (customer)

**Response**:
```json
{
  "success": true,
  "data": {
    "can_review": false,
    "reason": "Already reviewed this seller this week"
  }
}
```

**Possible Reasons**:
- `Order not found`
- `Not your order`
- `Order not completed yet`
- `Already reviewed`
- `Already reviewed this seller this week` (spam prevention)

---

## Spam Prevention

MenuMaker implements multiple spam prevention mechanisms:

### 1. One Review Per Order
- Each order can only be reviewed once
- Prevents duplicate reviews

### 2. Weekly Rate Limit
- Customer can review **same seller** max **once per week**
- Prevents review bombing
- Checked before submission

### 3. Verified Purchases Only
- Only customers with **completed orders** can review
- `is_verified_purchase = true` for all reviews
- No fake reviews

### 4. Character Limits
- Review text: Max 500 characters
- Response text: Max 500 characters

### 5. Photo Limits
- Max 3 photos per review

---

## Auto-Approval Cron Job

**Job**: Auto-approve pending reviews after 24 hours

**Schedule**: Runs daily (recommended: every 6 hours)

**Logic**:
```typescript
// Find reviews where:
// - status = 'pending'
// - auto_approve_at < NOW()

// For each expired review:
// - status = 'approved'
// - is_public = true
// - approved_at = NOW()
```

**Implementation**:
```typescript
import { ReviewService } from './services/ReviewService';

// Cron job (e.g., node-cron)
cron.schedule('0 */6 * * *', async () => {
  const reviewService = new ReviewService();
  const count = await reviewService.autoApprovePendingReviews();
  console.log(`Auto-approved ${count} reviews`);
});
```

---

## Email Notifications

### Customer Notifications

1. **Review Reminder** (7 days after order completion)
   ```
   Subject: How was your order from [Business Name]?

   Hi [Customer Name],

   Thank you for ordering from [Business Name]! We'd love to hear your feedback.

   [Leave a Review Button]

   This link expires in 7 days.
   ```

2. **Review Approved** (seller approves before 24h)
   ```
   Subject: Your review is now published

   Your review of [Business Name] has been published. Thank you for sharing your feedback!
   ```

### Seller Notifications

1. **New Review (Rating ≥ 3)**
   ```
   Subject: New review from [Customer Name]

   You have a new [X]-star review! Review it before it's automatically published in 24 hours.

   [View Review]
   ```

2. **Complaint (Rating < 3)**
   ```
   Subject: ⚠️ Customer complaint - Immediate attention required

   A customer left a [X]-star review. Please address this complaint promptly.

   [View Complaint]
   ```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/reviews` | POST | Submit review |
| `/reviews/:id` | GET | Get review by ID |
| `/reviews/business/:businessId` | GET | Get business reviews |
| `/reviews/pending/business/:businessId` | GET | Get pending reviews (seller) |
| `/reviews/:id/moderate` | PUT | Moderate review (seller) |
| `/reviews/:id/response` | POST | Add seller response |
| `/reviews/:id/complaint` | PUT | Update complaint status |
| `/reviews/metrics/business/:businessId` | GET | Get review metrics |
| `/reviews/trends/business/:businessId` | GET | Get review trends |
| `/reviews/order/:orderId` | GET | Get review for order |
| `/reviews/order/:orderId/can-review` | GET | Check if can review |

---

## Best Practices

### For Sellers

1. **Respond Promptly to Complaints**
   - Monitor low-rating reviews (< 3 stars)
   - Contact customer within 24 hours
   - Update complaint status to `in_progress`

2. **Leverage 24-Hour Window**
   - Review pending reviews daily
   - Approve good reviews immediately
   - Only request removal for spam/offensive content

3. **Respond to Reviews**
   - Thank positive reviewers
   - Address negative feedback constructively
   - Aim for >80% response rate

4. **Monitor Metrics**
   - Track average rating monthly
   - Identify trends (improving vs declining)
   - Set goal (e.g., maintain 4.5+ stars)

### For Customers

1. **Leave Honest Feedback**
   - Be specific about what you liked/disliked
   - Include photos if helpful
   - Rate fairly based on entire experience

2. **Use Complaints Wisely**
   - If rating < 3, explain the issue clearly
   - Respond to seller's resolution attempts
   - Update complaint status if resolved

---

## Success Metrics

**Target Impact**:
- ⭐ **Average Rating**: 4.5+ stars for active sellers
- 📊 **Review Coverage**: 60% of completed orders reviewed
- ⚡ **Response Rate**: 80%+ seller response rate
- ✅ **Complaint Resolution**: 90% resolved within 48 hours
- 🛡️ **Spam Prevention**: <1% duplicate/spam reviews

---

## Support

**For Review Issues**:
- Submit review: `POST /api/v1/reviews`
- Check eligibility: `GET /api/v1/reviews/order/:orderId/can-review`
- View metrics: `GET /api/v1/reviews/metrics/business/:businessId`

**For Seller Moderation**:
- View pending: `GET /api/v1/reviews/pending/business/:businessId`
- Moderate: `PUT /api/v1/reviews/:id/moderate`
- Respond: `POST /api/v1/reviews/:id/response`

**For Complaints**:
- Update status: `PUT /api/v1/reviews/:id/complaint`
- Escalate if needed: Set `status = 'escalated'`

---

**Status**: ✅ Phase 3 - US3.5 Complete
**Review Submission**: 1-5 star rating with text and photos
**Moderation**: 24-hour seller review window
**Complaints**: Auto-flag ratings < 3, immediate notification
**Seller Responses**: Public replies to reviews
**Metrics**: Average rating, distribution, trends
**Spam Prevention**: 1 review per order, 1 per seller per week
