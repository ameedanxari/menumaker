# Quickstart & Acceptance Scenarios: MenuMaker MVP

**Input**: Feature spec + Implementation plan  
**Purpose**: Define acceptance scenarios and smoke tests to validate MVP completeness

---

## Local Development Setup (First-Time)

### Prerequisites
- Node.js 20 LTS, npm
- Docker (Postgres + MinIO)
- Git, VS Code with Claude Code
- macOS/Linux (zsh)

### One-Time Setup (5 minutes)

```bash
# Clone or navigate to repo
cd /Users/macintosh/Documents/Projects/MenuMaker

# Install dependencies
npm install                    # Root package.json (if monorepo setup script)
cd backend && npm install
cd ../frontend && npm install
cd ..

# Start services (Docker Compose)
docker-compose up -d

# Run migrations
cd backend
npm run migrate
cd ..

# Start backend (terminal 1)
cd backend
npm run dev
# Output: Fastify listening on http://localhost:3001

# Start frontend (terminal 2)
cd frontend
npm run dev
# Output: Vite dev server at http://localhost:3000
```

### Verify Local Setup
- Backend API: `curl http://localhost:3001/v1/health` → `{ "status": "ok" }`
- Frontend: Open `http://localhost:3000` → Empty state with signup link

---

## Acceptance Scenarios (Critical User Journeys)

### Scenario 1: Seller Onboarding & Menu Publication
**Epic**: Seller signs up → creates business → adds dishes → publishes menu → verifies public URL

**Setup**: Fresh database, no users

**Steps**:

1. **Sign Up**
   - Go to `http://localhost:3000`
   - Click "Sign Up"
   - Enter email: `testeller@example.com`, password: `TestPassword123`
   - Click "Sign Up" button
   - ✅ Redirected to business setup page
   - ✅ Email received with confirmation link (SendGrid/Mailhog dev)

2. **Create Business Profile**
   - Enter business name: `Priya's Tiffins`
   - Upload logo: Use `test-logo.png` (< 2MB)
   - Select primary color: `#E74C3C` (red)
   - Click "Create Business"
   - ✅ Business created; redirected to dashboard
   - ✅ Dashboard shows "Create Your First Menu" CTA

3. **Add Dishes**
   - Click "Add Dishes"
   - Add 3 dishes:
     - Sambar Rice | Rs. 75 | "Fluffy basmati with sambar" | Allergen: Dairy | Upload image
     - Dosa | Rs. 60 | "Crispy dosa, light and thin" | Allergen: Gluten | Upload image
     - Sweet Pongal | Rs. 50 | "Jaggery and rice pudding" | Allergen: Nuts | Upload image
   - ✅ All dishes appear in dashboard list
   - ✅ Drag-to-reorder works

4. **Create & Publish Menu**
   - Click "Create Weekly Menu"
   - Title: "Week of Nov 10-16"
   - Start date: Today, End date: Today + 6 days
   - Add all 3 dishes to menu
   - Click "Publish Menu"
   - ✅ Menu status changes to "Published"
   - ✅ Public menu URL appears: `http://localhost:3000/menu/pRIyAS-tiffins` (slug-based)

5. **View Public Menu**
   - Open public URL in new browser tab
   - ✅ Menu displays: business name, logo, all 3 dishes with names, prices, images
   - ✅ Page loads in < 2s
   - ✅ Mobile-responsive (resize to 375px width)

6. **Share on WhatsApp**
   - Click "Share on WhatsApp" button
   - ✅ WhatsApp opens with text: "Check out Priya's Tiffins menu: http://localhost:3000/menu/..."
   - ✅ Message can be sent to a test contact

7. **Social Preview**
   - Go back to seller dashboard
   - Click "Social Preview" or "Share" button
   - ✅ OG meta tags present in page head:
     - `og:title`: "Priya's Tiffins - Weekly Menu"
     - `og:description`: "Sambar Rice, Dosa, Sweet Pongal"
     - `og:image`: Auto-generated preview image URL
   - ✅ Preview image shows business name + top 2 dishes

**Expected Duration**: 5–7 minutes
**Success Criteria**: All steps completed; menu live and shareable

---

### Scenario 2: Customer Places Order
**Epic**: Customer discovers public menu → adds items → places order → seller receives notification

**Setup**: Priya's business and menu from Scenario 1 are live

**Steps**:

1. **Customer Visits Public Menu**
   - Open `http://localhost:3000/menu/priyas-tiffins` in incognito browser
   - ✅ Menu loads; no login required
   - ✅ All dishes display with prices (Rs. 75, 60, 50)

2. **Add Items & Checkout**
   - Click "Add to Order" on Sambar Rice (qty: 2)
   - Click "Add to Order" on Dosa (qty: 1)
   - Click "Checkout"
   - ✅ Order summary shows: 2× Sambar Rice (150), 1× Dosa (60), Subtotal: 210
   - ✅ Delivery option appears: Pickup / Delivery (seller's choice in settings)

3. **Configure Delivery**
   - Assume Priya set flat Rs. 50 delivery fee
   - Select "Delivery"
   - ✅ Delivery fee added: 50 (total: 260)
   - Enter delivery address: "123 Main St, City"

4. **Enter Customer Info**
   - Name: `Rajesh Kumar`
   - Phone: `+919876543210`
   - Email: `rajesh@example.com` (optional)
   - Special notes: "No spice, extra rice"
   - Click "Place Order"
   - ✅ Order confirmation page shows order ID, total, and "We'll contact you soon"
   - ✅ Confirmation email sent to `rajesh@example.com`

5. **Seller Receives Order Notification**
   - Priya (logged in to dashboard) receives email: "New Order from Rajesh Kumar"
   - Click email link or dashboard "Orders" tab
   - ✅ New order displays:
     - Customer: Rajesh Kumar, +919876543210
     - Items: 2× Sambar Rice, 1× Dosa
     - Total: Rs. 260 (including delivery)
     - Status: Pending
     - Notes: "No spice, extra rice"

6. **Seller Marks Order as Confirmed**
   - Priya clicks order → "Confirm Order"
   - ✅ Order status changes to "Confirmed"
   - ✅ Customer receives email: "Your order is confirmed!"

7. **Seller Marks as Ready**
   - Click "Mark Ready for Pickup"
   - ✅ Status changes to "Ready"
   - ✅ Email sent to customer: "Your order is ready for pickup"

8. **Seller Marks as Fulfilled**
   - Click "Mark Fulfilled"
   - ✅ Status changes to "Fulfilled"
   - ✅ Order moves to "History" section

**Expected Duration**: 8–10 minutes
**Success Criteria**: Order created, seller notified, status transitions work

---

### Scenario 3: Payment & Reporting
**Epic**: Seller marks order paid → views sales report → exports CSV

**Setup**: Scenarios 1 & 2 completed; order created

**Steps**:

1. **Configure Payment Method**
   - Priya goes to Settings → Payment
   - Select "Bank Transfer"
   - Enter payment instructions: "Account: 123456, IFSC: HDFC0001234"
   - Click "Save"
   - ✅ Settings saved

2. **Customer Order Shows Payment Instructions**
   - Customer creates new order
   - On confirmation, sees: "Please pay via Bank Transfer: Account 123456, IFSC HDFC0001234"
   - ✅ Payment instructions visible

3. **Seller Marks Order Paid**
   - Priya views order in dashboard
   - Clicks "Mark as Paid"
   - ✅ Payment status changes to "Paid"
   - Payment status badge shows green "Paid"

4. **View Orders Report**
   - Click "Reports" tab
   - ✅ Summary card shows:
     - Total Orders: 2 (from scenarios)
     - Total Revenue: Rs. 520 (260 + 260 or similar)
     - Avg Order Value: Rs. 260
   - ✅ Orders appear in table with columns: Order ID, Customer, Items, Total, Status, Date

5. **Export CSV**
   - Click "Export as CSV"
   - ✅ File downloads: `orders_2025-11-10.csv`
   - ✅ CSV contains headers: order_id, customer_name, customer_phone, items, subtotal, delivery_fee, total, payment_status, order_status, created_at
   - ✅ All orders present in export

6. **Filter & Export Subset**
   - Select date range: Last 7 days
   - Filter by status: "Fulfilled"
   - Click "Export"
   - ✅ CSV contains only 1–2 fulfilled orders

**Expected Duration**: 5–7 minutes
**Success Criteria**: Payment methods configurable, reports generate and export correctly

---

## Smoke Tests (Automated, < 2 minutes)

### Pre-Deployment Checklist (Run via Playwright)

```javascript
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('Health check - Backend API', async ({ request }) => {
  const res = await request.get('http://localhost:3001/v1/health');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.status).toBe('ok');
});

test('Health check - Frontend loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('text=Sign Up')).toBeVisible();
});

test('OpenAPI spec is valid', async ({ request }) => {
  const res = await request.get('http://localhost:3001/v1/openapi.json');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.info.title).toBe('MenuMaker API');
});

test('Signup flow works (happy path)', async ({ page }) => {
  const testEmail = `test-${Date.now()}@example.com`;
  await page.goto('http://localhost:3000');
  await page.fill('[name=email]', testEmail);
  await page.fill('[name=password]', 'TestPassword123');
  await page.click('button:has-text("Sign Up")');
  await expect(page).toHaveURL(/.*\/business-setup/);
});

test('Public menu loads (no auth)', async ({ page }) => {
  // Assumes menu slug 'test-menu' exists
  await page.goto('http://localhost:3000/menu/test-menu');
  await expect(page.locator('text=test-menu')).toBeVisible();
  const loadTime = await page.evaluate(() => window.performance.timing.loadEventEnd - window.performance.timing.navigationStart);
  expect(loadTime).toBeLessThan(2000); // < 2 seconds
});

test('Lighthouse performance score > 90', async ({ page }) => {
  // Run Lighthouse on public menu page
  const url = 'http://localhost:3000/menu/test-menu';
  // (Note: Requires @playwright/test with Lighthouse integration or separate lighthouse CLI)
  // Expected: LCP < 2s, CLS < 0.1, FID < 100ms
});
```

**Run**: `npm run test:smoke` (backend + frontend must be running)

---

## Validation Checklist

### Feature Completeness
- [ ] All 7 user stories have passing acceptance scenarios
- [ ] Onboarding: < 10 minutes for non-technical user
- [ ] Menu editor: < 3 minutes to add 5 dishes
- [ ] Order flow: works for pickup and delivery
- [ ] Payment: manual method configured, order marked paid
- [ ] Reporting: CSV export accurate
- [ ] Delivery fee calculation correct (flat/distance/rounding rules)

### Non-Functional
- [ ] Frontend load time: < 2s on 4G (LCP metric)
- [ ] API latency: p95 < 200ms
- [ ] Lighthouse score: > 90 (desktop + mobile)
- [ ] Mobile responsive: 375px–1920px viewports
- [ ] Accessibility: WCAG 2.1 Level AA (keyboard nav, alt text, contrast)
- [ ] Error messages: clear and non-technical

### Security
- [ ] HTTPS enforced (or localhost http for dev)
- [ ] JWT auth working (valid token required for protected endpoints)
- [ ] Input validation: oversized images rejected, phone format validated
- [ ] XSS prevention: user inputs sanitized
- [ ] Rate limiting: login attempts throttled

### Data Integrity
- [ ] Order totals calculated correctly (sum + delivery fee)
- [ ] Delivery fee formula applied correctly
- [ ] CSV export matches dashboard data
- [ ] Emails sent reliably (checked in Mailhog dev)
- [ ] No data loss on network failure (order saved before email sent)

---

## Debugging Tips

### Backend Issues
- Logs: `docker logs menumaker_api` (if containerized) or terminal output
- Database: `docker exec menumaker_db psql -U postgres -d menumaker_dev -c "SELECT * FROM orders;"`
- Check `.env` variables: `cat .env` (don't commit secrets)

### Frontend Issues
- Browser console: F12 → Console tab for JS errors
- Network tab: Check API calls (should be to `http://localhost:3001/v1/...`)
- React DevTools: Inspect component state
- Vite HMR: Ensure no CSP issues preventing hot reload

### Local Services
- Postgres: `localhost:5432` (user: postgres, password: postgres)
- MinIO S3: `http://localhost:9000` (user: minioadmin, password: minioadmin)
- Mailhog: `http://localhost:1025` (SMTP), `http://localhost:8025` (web UI)

---

## Next Steps After Validation
1. Deploy to staging (Heroku/Render)
2. Run full test suite (unit + integration + e2e)
3. Performance audit (Lighthouse, load testing)
4. Security audit (OWASP, dependency scan)
5. User acceptance testing (invite 5–10 sellers)
6. Iterate and fix gaps
7. Deploy to production

---

## Time Box Summary
- **Scenario 1** (Onboarding & Menu): 5–7 min
- **Scenario 2** (Order Flow): 8–10 min
- **Scenario 3** (Payment & Reporting): 5–7 min
- **Smoke Tests**: < 2 min

**Total Happy Path Validation**: ~20–25 minutes
