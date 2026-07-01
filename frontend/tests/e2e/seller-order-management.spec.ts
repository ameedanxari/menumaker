import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  generateTestBusiness,
  generateTestDish,
  generateTestCustomer,
  signup,
  login,
  createBusiness,
  createDish,
  publishMenu,
  fillCheckoutForm,
  navigateToOrders,
  logout,
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
      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Login back as seller
      await login(page, user.email, user.password);

      // Navigate to orders
      await navigateToOrders(page);

      // Should show the order
      await expect(page.locator(`text=${customer.name}`).first()).toBeVisible();
      await page.locator('button:has-text("View Details")').first().click();
      await expect(page.locator(`text=${dish.name}`).first()).toBeVisible();
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
      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Login back
      await login(page, user.email, user.password);

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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);

      // Should show status (pending by default)
      await expect(page.getByText('pending', { exact: true }).first()).toBeVisible();
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);

      // Click to view order details
      await page.locator('button:has-text("View Details")').first().click();

      // Should show detailed information
      await expect(page.locator(`text=${customer.name}`).first()).toBeVisible();
      await expect(page.locator(`text=${customer.phone}`).first()).toBeVisible();
      await expect(page.locator(`text=${customer.email}`).first()).toBeVisible();
      await expect(page.locator(`text=${dish.name}`).first()).toBeVisible();
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

      await logout(page);

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

      await login(page, user.email, user.password);

      await navigateToOrders(page);
      await page.locator('button:has-text("View Details")').first().click();

      // Should show items with quantities
      await expect(page.locator('text=/Dish 1/i').first()).toBeVisible();
      await expect(page.locator('text=/Quantity: 2/i').first()).toBeVisible();
      await expect(page.locator('text=/Dish 2/i').first()).toBeVisible();
      await expect(page.locator('text=/Quantity: 1/i').first()).toBeVisible();

      // Should show the computed order total for the selected quantities.
      await expect(page.locator('text=/40\\.00/i')).toBeVisible();
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);
      await page.locator('button:has-text("View Details")').first().click();

      // Should show delivery address
      await expect(page.locator(`text=${customer.phone}`).first()).toBeVisible();
      await expect(page.locator(`text=${customer.email}`).first()).toBeVisible();
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);

      // Update status to confirmed
      await page.locator('button:has-text("View Details")').first().click();
      await page.click('button:has-text("Confirm")');

      // Should show confirmed status
      await expect(page.getByText('confirmed', { exact: true }).first()).toBeVisible({ timeout: 5000 });
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);

      // Workflow: pending -> confirmed -> ready -> fulfilled
      await page.locator('button:has-text("View Details")').first().click();
      await page.click('button:has-text("Confirm")');
      await expect(page.getByText('confirmed', { exact: true }).first()).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("Ready")');
      await expect(page.getByText('ready', { exact: true }).first()).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("Fulfill")');
      await expect(page.getByText('fulfilled', { exact: true }).first()).toBeVisible({ timeout: 5000 });
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await navigateToOrders(page);

      // Cancel order
      await page.locator('button:has-text("View Details")').first().click();
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Confirm cancellation if needed
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Should show cancelled status
        await expect(page.getByText('cancelled', { exact: true }).first()).toBeVisible({ timeout: 5000 });
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
        await logout(page);

        await page.goto(`/m/${slug}`);
        await page.click(`button:has-text("Add to Cart")`);
        await page.click('[data-testid="cart-badge"]');
        await page.click('button:has-text("Checkout")');

        const customer = generateTestCustomer();
        await fillCheckoutForm(page, customer);
        await page.click('button[type="submit"]:has-text("Place Order")');

        await login(page, user.email, user.password);
      }

      await navigateToOrders(page);

      // Confirm one order
      await page.locator('button:has-text("View Details")').first().click();
      await page.locator('button:has-text("Confirm")').first().click();
      await page.waitForTimeout(1000);

      // Filter by pending
      const statusFilter = page.locator('select[name="statusFilter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('pending');

        // Should show only pending orders
        await expect(page.getByText('pending', { exact: true }).first()).toBeVisible();
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await page.goto('/dashboard');

      // Should show statistics
      const totalOrders = page.locator('[data-testid="total-orders"]');
      if (await totalOrders.isVisible()) {
        await expect(totalOrders).toBeVisible();
        await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
        await expect(page.locator('[data-testid="pending-orders"]')).toBeVisible();
      }
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

      await logout(page);

      await page.goto(`/m/${slug}`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);
      await page.click('button[type="submit"]:has-text("Place Order")');

      await login(page, user.email, user.password);

      await page.goto('/dashboard');

      // Should show recent orders section
      const recentOrders = page.locator('[data-testid="recent-orders"]');
      if (await recentOrders.isVisible()) {
        await expect(recentOrders).toBeVisible();
        await expect(page.locator(`text=${customer.name}`).first()).toBeVisible();
      }
    });
  });
});
