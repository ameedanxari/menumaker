# MenuMaker Tax Compliance & Reporting Guide

**Phase 3: Advanced Reporting & Tax Compliance (US3.4)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker provides comprehensive tax compliance features for Indian GST regulations, including automated invoice generation, GST reports, and profit analysis.

### Key Features

✅ **Automated Tax Invoices**: GST-compliant invoices with breakdown by tax rate
✅ **GST Reports**: Monthly outward supplies summary for GSTR-1 filing
✅ **Profit Analysis**: Revenue vs expenses breakdown with processor fees
✅ **GSTIN Management**: Store and validate 15-character GSTIN
✅ **Invoice Numbering**: Auto-incrementing invoice numbers per business
✅ **HSN/SAC Codes**: Automatic assignment for food service (9963, 9964)

---

## GST Invoice Generation

### Automatic Invoice Creation

Tax invoices are automatically generated when an order is completed.

**Features**:
- Invoice number format: `INV-2025-0001` (customizable prefix)
- Financial year tracking (April-March)
- GST breakdown by rate (5%, 18%)
- Line items with HSN/SAC codes
- Customer and seller GSTIN (if registered)

### Invoice Structure

```json
{
  "invoice_number": "INV-2025-0001",
  "invoice_date": "2025-11-15",
  "financial_year": "2025-26",
  "seller_gstin": "22AAAAA0000A1Z5",
  "seller_business_name": "My Restaurant Pvt Ltd",
  "seller_address": "123 MG Road, Bangalore",
  "subtotal_cents": 1000000,  // Rs. 10,000 (before GST)
  "gst_breakdown": [
    {
      "rate": 5,
      "taxable_amount_cents": 1000000,
      "gst_amount_cents": 50000,  // Rs. 500
      "hsn_sac_code": "9963"
    }
  ],
  "total_gst_cents": 50000,
  "total_cents": 1050000,  // Rs. 10,500 (inclusive)
  "line_items": [
    {
      "description": "Paneer Butter Masala",
      "hsn_sac_code": "9963",
      "quantity": 2,
      "unit_price_cents": 28571,  // Rs. 285.71 (before GST)
      "gst_rate": 5,
      "gst_amount_cents": 1429,  // Rs. 14.29
      "total_cents": 60000  // Rs. 600 (inclusive)
    }
  ]
}
```

### GST Rates

| Service Type | GST Rate | HSN/SAC Code | Description |
|--------------|----------|--------------|-------------|
| Restaurant Service | 5% | 9963 | Dining in, takeaway, delivery |
| Catering Service | 18% | 9964 | Event catering, bulk orders |
| Packaged Food | 5% | 9963 | Pre-packaged food items |

---

## GSTIN Setup

### Configure Business GSTIN

**API**: `PUT /api/v1/businesses/:id/settings`

**Request**:
```json
{
  "gstin": "22AAAAA0000A1Z5",
  "is_gst_registered": true,
  "legal_business_name": "My Restaurant Pvt Ltd",
  "business_address": "123 MG Road, Bangalore - 560001",
  "invoice_prefix": "INV",
  "bank_details": {
    "account_name": "My Restaurant Pvt Ltd",
    "account_number": "1234567890",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank"
  },
  "invoice_terms": "Payment due within 30 days. No returns without prior approval."
}
```

**GSTIN Format**: 15 characters - `22AAAAA0000A1Z5`
- First 2 digits: State code (22 = Chhattisgarh)
- Next 10 characters: PAN number
- 13th character: Entity number
- 14th character: Z (default)
- 15th character: Checksum

---

## API Endpoints

### 1. Get Tax Invoice

**Endpoint**: `GET /api/v1/tax/invoices/:orderId`

**Response**:
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_number": "INV-2025-0001",
      "invoice_date": "2025-11-15",
      "financial_year": "2025-26",
      "subtotal_cents": 1000000,
      "total_gst_cents": 50000,
      "total_cents": 1050000,
      "gst_breakdown": [...],
      "line_items": [...],
      "pdf_url": "https://storage.example.com/invoices/INV-2025-0001.pdf"
    }
  }
}
```

### 2. Generate Tax Invoice (Manual)

**Endpoint**: `POST /api/v1/tax/invoices/:orderId/generate`

**Use Case**: Manually trigger invoice generation (normally automatic)

**Response**:
```json
{
  "success": true,
  "data": {
    "invoice": {...}
  },
  "message": "Tax invoice generated successfully"
}
```

### 3. GST Report (Monthly)

**Endpoint**: `GET /api/v1/tax/gst-report`

**Query Parameters**:
- `businessId` (required): Business UUID
- `startDate` (required): ISO date (e.g., `2025-11-01`)
- `endDate` (required): ISO date (e.g., `2025-11-30`)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "report": {
      "summary": {
        "total_orders": 150,
        "total_sales_cents": 15000000,  // Rs. 1,50,000
        "total_gst_collected_cents": 750000,  // Rs. 7,500
        "gst_by_rate": [
          {
            "rate": 5,
            "taxable_amount_cents": 14000000,  // Rs. 1,40,000
            "gst_amount_cents": 700000  // Rs. 7,000
          },
          {
            "rate": 18,
            "taxable_amount_cents": 1000000,  // Rs. 10,000
            "gst_amount_cents": 180000  // Rs. 1,800
          }
        ]
      },
      "invoices": [...]
    }
  }
}
```

### 4. Profit Analysis

**Endpoint**: `GET /api/v1/tax/profit-analysis`

**Query Parameters**:
- `businessId` (required): Business UUID
- `startDate` (required): ISO date
- `endDate` (required): ISO date

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "analysis": {
      "revenue": {
        "gross_sales_cents": 15000000,  // Rs. 1,50,000
        "by_month": [
          {
            "month": "2025-11",
            "amount_cents": 15000000
          }
        ],
        "by_processor": [
          {
            "processor": "razorpay",
            "amount_cents": 10000000  // Rs. 1,00,000
          },
          {
            "processor": "phonepe",
            "amount_cents": 5000000  // Rs. 50,000
          }
        ]
      },
      "expenses": {
        "total_expenses_cents": 450000,  // Rs. 4,500
        "processor_fees_cents": 300000,  // Rs. 3,000
        "subscription_fees_cents": 19900,  // Rs. 199
        "delivery_waivers_cents": 0,
        "refunds_cents": 130100  // Rs. 1,301
      },
      "profit": {
        "net_profit_cents": 14550000,  // Rs. 1,45,500
        "profit_margin_percentage": 97.0
      }
    }
  }
}
```

### 5. List Business Invoices

**Endpoint**: `GET /api/v1/tax/invoices/business/:businessId`

**Query Parameters**:
- `limit` (optional): Number of invoices (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range

**Response**:
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Financial Year Calculation

India's financial year runs from **April 1 to March 31**.

**Examples**:
- Invoice date: Nov 15, 2025 → FY: `2025-26`
- Invoice date: Feb 10, 2026 → FY: `2025-26`
- Invoice date: Apr 5, 2026 → FY: `2026-27`

---

## Invoice Numbering

### Auto-Increment Per Business

Each business maintains its own invoice sequence:

**Format**: `{prefix}-{year}-{number}`

**Examples**:
- `INV-2025-0001`
- `INV-2025-0002`
- `BILL-2025-0001` (custom prefix)

**Configuration**:
```json
{
  "invoice_prefix": "INV",  // Customizable
  "next_invoice_number": 1  // Auto-incremented
}
```

---

## GST Calculation (Reverse)

Prices in MenuMaker are **inclusive of GST**. Tax invoices must show the breakdown.

### Formula

```
Unit Price (before GST) = Unit Price (with GST) × 100 / (100 + GST Rate)
GST Amount = Unit Price (with GST) - Unit Price (before GST)
```

### Example

```
Dish Price (inclusive): Rs. 600 (60000 paise)
GST Rate: 5%

Unit Price (before GST) = 60000 × 100 / 105 = 57143 paise (Rs. 571.43)
GST Amount = 60000 - 57143 = 2857 paise (Rs. 28.57)

Verification: 57143 + 2857 = 60000 ✅
```

---

## GSTR-1 Filing (Monthly)

Use the GST Report to file GSTR-1 (Outward Supplies).

### Required Data

1. **Total B2C Sales** (small invoices < Rs. 2.5L):
   - Get from `total_sales_cents` in GST report
   - Breakdown by GST rate (5%, 18%)

2. **Invoice Count**:
   - Get from `total_orders` in GST report

3. **GST Collected**:
   - Get from `total_gst_collected_cents` in GST report

### Steps

1. Generate GST report for the month
2. Export invoice list (if needed for B2B)
3. File GSTR-1 on GST portal using summary data
4. Match GST collected with payouts received

---

## Profit Analysis Use Cases

### 1. Monthly P&L Statement

```
Revenue: Rs. 1,50,000
- Processor Fees: Rs. 3,000 (2%)
- Subscription: Rs. 199
- Refunds: Rs. 1,301
= Net Profit: Rs. 1,45,500 (97% margin)
```

### 2. Processor Comparison

Which processor is most cost-effective?

```
Razorpay: Rs. 1,00,000 revenue, Rs. 2,000 fees (2%)
PhonePe: Rs. 50,000 revenue, Rs. 590 fees (1.18%)
→ PhonePe has lower fees
```

### 3. Expense Tracking

Track recurring expenses:
- Processor fees (variable, ~2%)
- Subscription fees (fixed, Rs. 199/month)
- Refunds (customer service metric)

---

## Best Practices

### 1. GSTIN Registration

- Register for GST if annual turnover > Rs. 40L (services)
- Update GSTIN in business settings immediately
- Verify GSTIN on GST portal before adding

### 2. Invoice Generation

- Invoices auto-generate on order completion
- Manually generate if needed via API
- Store PDF copies for 6+ years (legal requirement)

### 3. Monthly Reconciliation

1. Generate GST report (1st-30th/31st)
2. Match with payout deposits
3. File GSTR-1 by 11th of next month
4. File GSTR-3B by 20th of next month

### 4. Record Keeping

- Keep all invoices for 6 years minimum
- Backup invoice PDFs to external storage
- Reconcile payouts with bank statements monthly

---

## Error Handling

### Invoice Generation Errors

**Error**: `Order not found`
- Verify order ID is correct
- Check order belongs to your business

**Error**: `Invoice already exists`
- Invoice already generated for this order
- Use GET endpoint to retrieve existing invoice

**Error**: `Order must be completed`
- Only completed orders get invoices
- Wait for order to complete before generating

### GSTIN Validation

**Invalid GSTIN format**:
- Must be exactly 15 characters
- Format: `22AAAAA0000A1Z5`
- Verify on GST portal before adding

---

## API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tax/invoices/:orderId` | GET | Get tax invoice for order |
| `/tax/invoices/:orderId/generate` | POST | Manually generate invoice |
| `/tax/gst-report` | GET | Monthly GST summary |
| `/tax/profit-analysis` | GET | Revenue vs expenses |
| `/tax/invoices/business/:businessId` | GET | List all invoices |

---

## Success Metrics

**Target Impact**:
- ⚡ **Automated Compliance**: 100% of completed orders get tax invoices
- 📊 **GSTR-1 Ready**: Monthly reports match GST portal requirements
- 💰 **Profit Visibility**: Real-time P&L tracking with processor breakdown
- ✅ **Audit Ready**: All invoices stored with GST breakdown

---

## Support

**For Tax Compliance Issues**:
- Configure GSTIN: `PUT /api/v1/businesses/:id/settings`
- Generate invoice: `POST /api/v1/tax/invoices/:orderId/generate`
- Get GST report: `GET /api/v1/tax/gst-report?businessId=xxx&startDate=2025-11-01&endDate=2025-11-30`

**For Profit Analysis**:
- View monthly P&L: `GET /api/v1/tax/profit-analysis?businessId=xxx&startDate=2025-11-01&endDate=2025-11-30`
- Track processor fees by payment processor breakdown

---

**Status**: ✅ Phase 3 - US3.4 Complete
**Tax Invoices**: Automated with GST breakdown
**GST Reports**: Monthly GSTR-1 ready reports
**Profit Analysis**: Revenue/expense tracking with processor comparison
**GSTIN Management**: 15-character validation and storage
