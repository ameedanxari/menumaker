# E2E Tests with Playwright

This directory contains end-to-end tests for the MenuMaker application using Playwright.

## Test Coverage

The E2E test suite covers the following critical user flows:

### 1. Authentication (`auth.spec.ts`)
- User signup with validation
- User login/logout
- Session persistence
- Protected route access
- Navigation between auth pages

### 2. Business Setup (`business-setup.spec.ts`)
- Business profile creation
- Business information updates
- Delivery settings configuration
- Operating hours management
- Business logo upload
- Multiple business support

### 3. Menu & Dish Management (`menu-management.spec.ts`)
- Dish creation with images
- Dish updates and deletion
- Availability toggling
- Category management
- Category reordering
- Menu creation and publishing
- Menu preview
- Menu archiving
- Public menu visibility
- Menu URL sharing
- Bulk operations

### 4. Customer Order Flow (`customer-order.spec.ts`)
- Public menu browsing (no login required)
- Shopping cart operations
  - Add to cart
  - Update quantities
  - Remove items
  - Calculate totals
- Checkout process
  - Form validation
  - Delivery fee calculation
  - Order submission
- Order confirmation

### 5. Seller Order Management (`seller-order-management.spec.ts`)
- Order list view
- Order details display
- Order status updates
  - Pending → Confirmed → Ready → Fulfilled
  - Order cancellation
- Order filtering by status
- Order search by customer
- Dashboard statistics
- Recent orders preview

## Running E2E Tests

### Prerequisites

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Playwright browsers**
   ```bash
   npx playwright install
   ```

3. **Start backend and database**
   The E2E tests require the backend API and database to be running:
   ```bash
   # From project root
   docker-compose up -d
   cd backend && npm run dev
   ```

### Run All Tests

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run with UI (headed mode)
npm run test:e2e:ui

# Run specific test file
npx playwright test auth.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

### Run Tests by Browser

```bash
# Run on Chromium only
npx playwright test --project=chromium

# Run on Firefox only
npx playwright test --project=firefox

# Run on WebKit only
npx playwright test --project=webkit

# Run on mobile Chrome
npx playwright test --project="Mobile Chrome"
```

### Test Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000` (frontend dev server)
- **Test Directory**: `./tests/e2e`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Retries**: 2 retries on CI, 0 locally
- **Parallel Execution**: Enabled by default
- **Auto-start Dev Server**: Enabled

## Test Structure

### Helper Functions (`helpers.ts`)

The test suite includes reusable helper functions:

**Test Data Generators**
- `generateTestUser()` - Creates unique user credentials
- `generateTestBusiness()` - Creates business data
- `generateTestDish()` - Creates dish data
- `generateTestCustomer()` - Creates customer data

**Authentication Helpers**
- `signup(page, email, password)` - Complete signup flow
- `login(page, email, password)` - Complete login flow
- `logout(page)` - Logout current user

**Business Helpers**
- `createBusiness(page, businessData)` - Create business profile

**Menu Helpers**
- `createDish(page, dishData)` - Add dish to menu
- `createMenu(page, menuName)` - Create new menu
- `publishMenu(page)` - Publish current menu

**Order Helpers**
- `fillCheckoutForm(page, customerData)` - Fill checkout form
- `navigateToOrders(page)` - Go to orders page
- `updateOrderStatus(page, orderId, status)` - Update order status

**Assertion Helpers**
- `assertBusinessCreated(page, businessName)` - Verify business creation
- `assertMenuPublished(page)` - Verify menu is published
- `assertOrderPlaced(page)` - Verify order confirmation

## Writing New Tests

### Best Practices

1. **Use helper functions** for common workflows
2. **Generate unique test data** to avoid conflicts
3. **Wait for explicit conditions** instead of arbitrary timeouts
4. **Use data-testid attributes** for reliable selectors
5. **Clean up after tests** (logout, clear state)

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { generateTestUser, signup } from './helpers';

test('should perform user action', async ({ page }) => {
  // Setup
  const user = generateTestUser();
  await signup(page, user.email, user.password);

  // Action
  await page.click('button:has-text("Action")');

  // Assertion
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Debugging Tests

### Playwright Inspector

Run tests with the Playwright Inspector for step-by-step debugging:

```bash
npx playwright test --debug
```

### Visual Traces

View trace files for failed tests:

```bash
npx playwright show-trace trace.zip
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots
- Trace files
- Console logs

Located in: `test-results/`

## CI/CD Integration

Tests are configured to run in CI environments:

- Retries enabled (2 attempts)
- Single worker (sequential execution)
- Fail on `.only` in code
- HTML report generation

## Troubleshooting

### Tests Timing Out

- Ensure backend is running on `http://localhost:3001`
- Ensure frontend is running on `http://localhost:3000`
- Check database is accessible

### Flaky Tests

- Use explicit waits: `await expect(locator).toBeVisible()`
- Avoid fixed timeouts: `await page.waitForTimeout(1000)`
- Wait for network idle: `await page.waitForLoadState('networkidle')`

### Test Data Conflicts

- Use `generateTestUser()` and similar helpers
- Each test should create unique data
- Clean up test data after execution

## Test Maintenance

### Updating Selectors

When UI changes, update selectors in:
1. Test files (`.spec.ts`)
2. Helper functions (`helpers.ts`)

### Adding New Flows

1. Create new `.spec.ts` file
2. Add test data generators to `helpers.ts`
3. Add helper functions for the new flow
4. Write tests following existing patterns
5. Update this README

## Coverage Goals

Target E2E test coverage:
- ✅ All critical user flows
- ✅ Happy path scenarios
- ✅ Error handling and validation
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
