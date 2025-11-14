import { Page, expect } from '@playwright/test';

/**
 * Test data generators and helper functions for E2E tests
 */

export const generateTestEmail = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

export const generateTestUser = () => ({
  email: generateTestEmail(),
  password: 'Test123456!',
});

export const generateTestBusiness = () => ({
  name: `Test Restaurant ${Date.now()}`,
  description: 'A test restaurant for E2E testing',
  phone: '+1234567890',
  address: '123 Test Street',
  city: 'Test City',
  state: 'TS',
  zipCode: '12345',
});

export const generateTestDish = () => ({
  name: `Test Dish ${Date.now()}`,
  description: 'Delicious test dish',
  price: '12.99',
});

export const generateTestCustomer = () => ({
  name: 'John Doe',
  phone: '+1987654321',
  email: 'customer@example.com',
  address: '456 Customer Ave',
  city: 'Customer City',
  state: 'CS',
  zipCode: '54321',
});

/**
 * Authentication helpers
 */
export async function signup(page: Page, email: string, password: string) {
  await page.goto('/signup');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation after signup
  await page.waitForURL(/\/business\/new|\/dashboard/, { timeout: 10000 });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for successful login
  await page.waitForURL(/\/dashboard|\/business/, { timeout: 10000 });
}

export async function logout(page: Page) {
  // Click user menu or logout button
  await page.click('button[aria-label="User menu"]');
  await page.click('text=Logout');
  await page.waitForURL('/login');
}

/**
 * Business setup helpers
 */
export async function createBusiness(page: Page, businessData: any) {
  await page.goto('/business/new');

  await page.fill('input[name="name"]', businessData.name);
  await page.fill('textarea[name="description"]', businessData.description);
  await page.fill('input[name="phone"]', businessData.phone);
  await page.fill('input[name="address"]', businessData.address);
  await page.fill('input[name="city"]', businessData.city);
  await page.fill('input[name="state"]', businessData.state);
  await page.fill('input[name="zipCode"]', businessData.zipCode);

  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Menu and dish helpers
 */
export async function createDish(page: Page, dishData: any) {
  // Assuming we're on the menu editor page
  await page.click('button:has-text("Add Dish")');

  await page.fill('input[name="name"]', dishData.name);
  await page.fill('textarea[name="description"]', dishData.description);
  await page.fill('input[name="price"]', dishData.price);

  await page.click('button:has-text("Save Dish")');

  // Wait for dish to appear in list
  await expect(page.locator(`text=${dishData.name}`)).toBeVisible({ timeout: 5000 });
}

export async function createMenu(page: Page, menuName: string) {
  await page.goto('/menu/new');

  await page.fill('input[name="name"]', menuName);
  await page.click('button[type="submit"]');

  // Wait for menu editor to load
  await page.waitForURL(/\/menu\/\w+\/edit/, { timeout: 10000 });
}

export async function publishMenu(page: Page) {
  await page.click('button:has-text("Publish")');

  // Confirm publish if there's a confirmation dialog
  const confirmButton = page.locator('button:has-text("Confirm")');
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }

  // Wait for success message
  await expect(page.locator('text=/published|live/i')).toBeVisible({ timeout: 5000 });
}

/**
 * Order helpers
 */
export async function addDishToCart(page: Page, dishName: string) {
  await page.click(`[data-dish-name="${dishName}"] button:has-text("Add to Cart")`);

  // Wait for cart count to update
  await expect(page.locator('[data-testid="cart-count"]')).not.toHaveText('0');
}

export async function proceedToCheckout(page: Page) {
  await page.click('button:has-text("Checkout")');
  await page.waitForURL(/\/checkout/, { timeout: 10000 });
}

export async function fillCheckoutForm(page: Page, customerData: any) {
  await page.fill('input[name="customerName"]', customerData.name);
  await page.fill('input[name="customerPhone"]', customerData.phone);
  await page.fill('input[name="customerEmail"]', customerData.email);
  await page.fill('input[name="deliveryAddress"]', customerData.address);
  await page.fill('input[name="deliveryCity"]', customerData.city);
  await page.fill('input[name="deliveryState"]', customerData.state);
  await page.fill('input[name="deliveryZipCode"]', customerData.zipCode);
}

export async function submitOrder(page: Page) {
  await page.click('button[type="submit"]:has-text("Place Order")');

  // Wait for order confirmation
  await page.waitForURL(/\/order-confirmation/, { timeout: 10000 });
}

/**
 * Seller order management helpers
 */
export async function navigateToOrders(page: Page) {
  await page.goto('/orders');
  await page.waitForLoadState('networkidle');
}

export async function updateOrderStatus(page: Page, orderId: string, status: string) {
  // Find the order row and click the status button
  await page.click(`[data-order-id="${orderId}"] button:has-text("${status}")`);

  // Wait for status update to complete
  await page.waitForTimeout(1000);
}

/**
 * Assertion helpers
 */
export async function assertBusinessCreated(page: Page, businessName: string) {
  // Check that we're on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);

  // Check that business name appears on the page
  await expect(page.locator(`text=${businessName}`)).toBeVisible();
}

export async function assertMenuPublished(page: Page) {
  // Check for published status indicator
  await expect(page.locator('[data-testid="menu-status"]:has-text("Published")')).toBeVisible();
}

export async function assertOrderPlaced(page: Page) {
  // Check for order confirmation message
  await expect(page.locator('text=/order confirmed|thank you for your order/i')).toBeVisible();

  // Check for order ID
  await expect(page.locator('[data-testid="order-id"]')).toBeVisible();
}
