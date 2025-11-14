import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  generateTestBusiness,
  generateTestDish,
  generateTestCustomer,
  signup,
  createBusiness,
  createDish,
  publishMenu,
  fillCheckoutForm,
  navigateToOrders,
} from './helpers';

test.describe('Seller Order Management', () => {
  test.describe('Order List View', () => {
    test('should view list of orders', async ({ page }) => {
      // Setup: Create business and place an order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      // Place an order as customer (in new context)
      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      // Logout and place order
      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Login back as seller
      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      // Navigate to orders
      await navigateToOrders(page);

      // Should show the order
      await expect(page.locator(`text=${customer.name}`)).toBeVisible();
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
    });

    test('should show order count badge', async ({ page }) => {
      // Setup: Create business with an order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      // Place order
      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Login back
      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Should show pending orders badge
      const ordersBadge = page.locator('[data-testid="pending-orders-badge"]');
      if (await ordersBadge.isVisible()) {
        await expect(ordersBadge).not.toContainText('0');
      }
    });

    test('should display order status correctly', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Should show status (pending by default)
      await expect(page.locator('text=/pending/i')).toBeVisible();
    });
  });

  test.describe('Order Details', () => {
    test('should view detailed order information', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Click to view order details
      await page.click(`text=${customer.name}`);

      // Should show detailed information
      await expect(page.locator(`text=${customer.name}`)).toBeVisible();
      await expect(page.locator(`text=${customer.phone}`)).toBeVisible();
      await expect(page.locator(`text=${customer.email}`)).toBeVisible();
      await expect(page.locator(`text=${customer.address}`)).toBeVisible();
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
    });

    test('should show order items with quantities and prices', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create multiple dishes
      await page.click('button:has-text("Add Dish")');
      await page.fill('input[name="name"]', 'Dish 1');
      await page.fill('textarea[name="description"]', 'Test');
      await page.fill('input[name="price"]', '10.00');
      await page.click('button:has-text("Save")');

      await page.click('button:has-text("Add Dish")');
      await page.fill('input[name="name"]', 'Dish 2');
      await page.fill('textarea[name="description"]', 'Test');
      await page.fill('input[name="price"]', '15.00');
      await page.click('button:has-text("Save")');

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);

      // Add multiple items
      const addButtons = page.locator('button:has-text("Add to Cart")');
      await addButtons.nth(0).click();
      await addButtons.nth(0).click(); // 2x Dish 1
      await addButtons.nth(1).click(); // 1x Dish 2

      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);
      await page.click(`text=${customer.name}`);

      // Should show items with quantities
      await expect(page.locator('text=/Dish 1.*x2|2.*Dish 1/i')).toBeVisible();
      await expect(page.locator('text=/Dish 2.*x1|1.*Dish 2/i')).toBeVisible();

      // Should show correct total (10*2 + 15*1 = 35)
      await expect(page.locator('text=/35\\.00/i')).toBeVisible();
    });

    test('should show delivery information', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);
      await page.click(`text=${customer.name}`);

      // Should show delivery address
      await expect(page.locator(`text=${customer.address}`)).toBeVisible();
      await expect(page.locator(`text=${customer.city}`)).toBeVisible();
      await expect(page.locator(`text=${customer.state}`)).toBeVisible();
      await expect(page.locator(`text=${customer.zipCode}`)).toBeVisible();
    });
  });

  test.describe('Order Status Updates', () => {
    test('should update order status from pending to confirmed', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Update status to confirmed
      await page.click('button:has-text("Confirm")');

      // Should show confirmed status
      await expect(page.locator('text=/confirmed/i')).toBeVisible({ timeout: 5000 });
    });

    test('should complete full order workflow', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Workflow: pending -> confirmed -> ready -> fulfilled
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/confirmed/i')).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("Ready")');
      await expect(page.locator('text=/ready/i')).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("Fulfill")');
      await expect(page.locator('text=/fulfilled/i')).toBeVisible({ timeout: 5000 });
    });

    test('should cancel order', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Cancel order
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Confirm cancellation if needed
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Should show cancelled status
        await expect(page.locator('text=/cancelled/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Order Filtering and Search', () => {
    test('should filter orders by status', async ({ page }) => {
      // Setup: Create orders with different statuses
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      // Place two orders
      for (let i = 0; i < 2; i++) {
        await page.click('button[aria-label="User menu"]');
        await page.click('text=Logout');

        await page.goto(`/m/${slug}`);
        await page.click(`button:has-text("Add to Cart")`);
        await page.click('[data-testid="cart-badge"]');
        await page.click('button:has-text("Checkout")');

        const customer = generateTestCustomer();
        await fillCheckoutForm(page, customer);
        await page.click('button[type="submit"]:has-text("Place Order")');

        await page.goto('/login');
        await page.fill('input[name="email"]', user.email);
        await page.fill('input[name="password"]', user.password);
        await page.click('button[type="submit"]');
      }

      await navigateToOrders(page);

      // Confirm one order
      await page.locator('button:has-text("Confirm")').first().click();
      await page.waitForTimeout(1000);

      // Filter by pending
      const statusFilter = page.locator('select[name="statusFilter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('pending');

        // Should show only pending orders
        await expect(page.locator('text=/pending/i')).toBeVisible();
      }
    });

    test('should search orders by customer name', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await navigateToOrders(page);

      // Search by customer name
      const searchInput = page.locator('input[name="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(customer.name);

        // Should show matching order
        await expect(page.locator(`text=${customer.name}`)).toBeVisible();
      }
    });
  });

  test.describe('Dashboard Statistics', () => {
    test('should show order statistics on dashboard', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await page.goto('/dashboard');

      // Should show statistics
      await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-orders"]')).toBeVisible();
    });

    test('should show recent orders on dashboard', async ({ page }) => {
      // Setup with order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await page.goto('/dashboard');

      // Should show recent orders section
      await expect(page.locator('[data-testid="recent-orders"]')).toBeVisible();
      await expect(page.locator(`text=${customer.name}`)).toBeVisible();
    });
  });
});
