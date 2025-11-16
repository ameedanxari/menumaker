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
  assertOrderPlaced,
} from './helpers';

test.describe('Customer Order Flow', () => {
  test.describe('Public Menu Browsing', () => {
    test('should view public menu without login', async ({ page }) => {
      // Setup: Create seller account, business, and published menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      // Get public menu URL
      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      // Logout seller (simulate customer)
      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      // Navigate to public menu
      await page.goto(`/m/${slug}`);

      // Should view menu without being logged in
      await expect(page.locator(`text=${business.name}`)).toBeVisible();
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
      await expect(page.locator(`text=${dish.description}`)).toBeVisible();
      await expect(page.locator(`text=${dish.price}`)).toBeVisible();
    });

    test('should display business information on public menu', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.goto(`/m/${slug}`);

      // Should show business details
      await expect(page.locator(`text=${business.name}`)).toBeVisible();
      await expect(page.locator(`text=${business.description}`)).toBeVisible();
      await expect(page.locator(`text=${business.phone}`)).toBeVisible();
    });

    test('should show 404 for non-existent business slug', async ({ page }) => {
      await page.goto('/m/nonexistent-business-123');

      // Should show not found message
      await expect(page.locator('text=/not found|404/i')).toBeVisible();
    });

    test('should show message when no menu is published', async ({ page }) => {
      // Create business but don't publish menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');

      await page.goto(`/m/${slug}`);

      // Should show no active menu message
      await expect(page.locator('text=/no active menu|coming soon/i')).toBeVisible();
    });
  });

  test.describe('Shopping Cart', () => {
    test('should add dish to cart', async ({ page }) => {
      // Setup: Create published menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add dish to cart
      await page.click(`button:has-text("Add to Cart")`);

      // Should update cart count
      await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

      // Cart badge should be visible
      await expect(page.locator('[data-testid="cart-badge"]')).toBeVisible();
    });

    test('should add multiple quantities of same dish', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add same dish multiple times
      await page.click(`button:has-text("Add to Cart")`);
      await page.click(`button:has-text("Add to Cart")`);
      await page.click(`button:has-text("Add to Cart")`);

      // Should show count of 3
      await expect(page.locator('[data-testid="cart-count"]')).toContainText('3');
    });

    test('should add multiple different dishes to cart', async ({ page }) => {
      // Setup: Create multiple dishes
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dishes = [generateTestDish(), generateTestDish(), generateTestDish()];
      for (const dish of dishes) {
        await createDish(page, dish);
        await page.waitForTimeout(500);
      }

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add different dishes to cart
      const addButtons = page.locator('button:has-text("Add to Cart")');
      const count = await addButtons.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        await addButtons.nth(i).click();
        await page.waitForTimeout(300);
      }

      // Should show count of 3
      await expect(page.locator('[data-testid="cart-count"]')).toContainText('3');
    });

    test('should view cart details', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add to cart
      await page.click(`button:has-text("Add to Cart")`);

      // View cart
      await page.click('[data-testid="cart-badge"]');

      // Should show cart details
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
      await expect(page.locator(`text=${dish.price}`)).toBeVisible();
    });

    test('should update quantity in cart', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add to cart and view cart
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');

      // Increase quantity
      const increaseButton = page.locator('button[aria-label="Increase quantity"]');
      if (await increaseButton.isVisible()) {
        await increaseButton.click();
        await expect(page.locator('[data-testid="cart-count"]')).toContainText('2');
      }

      // Decrease quantity
      const decreaseButton = page.locator('button[aria-label="Decrease quantity"]');
      if (await decreaseButton.isVisible()) {
        await decreaseButton.click();
        await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');
      }
    });

    test('should remove item from cart', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add to cart and view cart
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');

      // Remove item
      const removeButton = page.locator('button[aria-label="Remove item"]');
      if (await removeButton.isVisible()) {
        await removeButton.click();

        // Cart should be empty
        await expect(page.locator('text=/cart is empty|no items/i')).toBeVisible();
      }
    });

    test('should calculate cart total correctly', async ({ page }) => {
      // Setup: Create dishes with known prices
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create dishes with specific prices
      await page.click('button:has-text("Add Dish")');
      await page.fill('input[name="name"]', 'Dish 1');
      await page.fill('textarea[name="description"]', 'Test dish 1');
      await page.fill('input[name="price"]', '10.00');
      await page.click('button:has-text("Save")');

      await page.click('button:has-text("Add Dish")');
      await page.fill('input[name="name"]', 'Dish 2');
      await page.fill('textarea[name="description"]', 'Test dish 2');
      await page.fill('input[name="price"]', '15.00');
      await page.click('button:has-text("Save")');

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add both dishes to cart
      const addButtons = page.locator('button:has-text("Add to Cart")');
      await addButtons.nth(0).click();
      await addButtons.nth(1).click();

      // View cart
      await page.click('[data-testid="cart-badge"]');

      // Should show correct subtotal (10 + 15 = 25)
      await expect(page.locator('text=/25\\.00/i')).toBeVisible();
    });
  });

  test.describe('Checkout Process', () => {
    test('should complete full checkout flow', async ({ page }) => {
      // Setup: Create published menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add to cart and proceed to checkout
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      // Fill checkout form
      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);

      // Submit order
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Should show order confirmation
      await assertOrderPlaced(page);
    });

    test('should show delivery fee in checkout', async ({ page }) => {
      // Setup: Configure delivery fee
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Set delivery fee in settings
      await page.goto('/business/settings');
      await page.selectOption('select[name="deliveryFeeType"]', 'flat');
      await page.fill('input[name="deliveryFee"]', '5.00');
      await page.click('button[type="submit"]:has-text("Save")');

      // Create and publish menu
      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Add to cart and go to checkout
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      // Should show delivery fee
      await expect(page.locator('text=/delivery.*5\\.00/i')).toBeVisible();
    });

    test('should show validation errors for required checkout fields', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      // Go to checkout without filling form
      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      // Try to submit empty form
      await page.click('button[type="submit"]:has-text("Place Order")');

      // Should show validation errors
      await expect(page.locator('text=/name.*required|required/i').first()).toBeVisible();
    });

    test('should validate phone number format', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      // Fill with invalid phone
      await page.fill('input[name="customerName"]', 'John Doe');
      await page.fill('input[name="customerPhone"]', 'invalid');
      await page.fill('input[name="customerEmail"]', 'test@example.com');

      await page.click('button[type="submit"]:has-text("Place Order")');

      // Should show phone validation error
      await expect(page.locator('text=/invalid.*phone|phone.*format/i')).toBeVisible();
    });

    test('should show order summary before placing order', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      // Should show order summary
      await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
      await expect(page.locator('text=/subtotal/i')).toBeVisible();
      await expect(page.locator('text=/total/i')).toBeVisible();
    });
  });

  test.describe('Order Confirmation', () => {
    test('should display order ID after successful order', async ({ page }) => {
      // Setup and place order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);

      await page.click('button[type="submit"]:has-text("Place Order")');

      // Should show order ID
      await expect(page.locator('[data-testid="order-id"]')).toBeVisible();
      await expect(page.locator('text=/#\\d+|order.*#/i')).toBeVisible();
    });

    test('should display order details on confirmation page', async ({ page }) => {
      // Setup and place order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);

      await page.click('button[type="submit"]:has-text("Place Order")');

      // Should show order details
      await expect(page.locator(`text=${customer.name}`)).toBeVisible();
      await expect(page.locator(`text=${customer.phone}`)).toBeVisible();
      await expect(page.locator(`text=${dish.name}`)).toBeVisible();
    });

    test('should clear cart after successful order', async ({ page }) => {
      // Setup and place order
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');
      const dish = generateTestDish();
      await createDish(page, dish);
      await publishMenu(page);

      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      await page.goto(`/m/${slug}`);

      await page.click(`button:has-text("Add to Cart")`);
      await page.click('[data-testid="cart-badge"]');
      await page.click('button:has-text("Checkout")');

      const customer = generateTestCustomer();
      await fillCheckoutForm(page, customer);

      await page.click('button[type="submit"]:has-text("Place Order")');

      // Wait for order to be placed
      await page.waitForURL(/\/order-confirmation/, { timeout: 10000 });

      // Navigate back to menu
      await page.goto(`/m/${slug}`);

      // Cart should be empty
      const cartBadge = page.locator('[data-testid="cart-count"]');
      if (await cartBadge.isVisible()) {
        await expect(cartBadge).toContainText('0');
      }
    });
  });
});
