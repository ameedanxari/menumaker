import { test, expect } from '@playwright/test';
import { generateTestUser, signup, login, logout } from './helpers';

test.describe('Authentication Flow', () => {
  test.describe('User Signup', () => {
    test('should successfully create a new account', async ({ page }) => {
      const user = generateTestUser();

      await signup(page, user.email, user.password);

      // Should redirect to business setup or dashboard
      await expect(page).toHaveURL(/\/business\/new|\/dashboard/);

      // Should show user is logged in (check for user menu or logout button)
      const userMenu = page.locator('button[aria-label="User menu"]');
      await expect(userMenu).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for invalid email', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.fill('input[name="confirmPassword"]', 'Test123456!');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/invalid email|email format/i')).toBeVisible();
    });

    test('should show error for password mismatch', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('input[name="email"]', generateTestUser().email);
      await page.fill('input[name="password"]', 'Test123456!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword!');
      await page.click('button[type="submit"]');

      // Should show password mismatch error
      await expect(page.locator('text=/passwords do not match|password mismatch/i')).toBeVisible();
    });

    test('should show error for weak password', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('input[name="email"]', generateTestUser().email);
      await page.fill('input[name="password"]', 'weak');
      await page.fill('input[name="confirmPassword"]', 'weak');
      await page.click('button[type="submit"]');

      // Should show weak password error
      await expect(page.locator('text=/password.*too short|weak password|at least 8 characters/i')).toBeVisible();
    });

    test('should show error when trying to signup with existing email', async ({ page }) => {
      const user = generateTestUser();

      // First signup
      await signup(page, user.email, user.password);

      // Logout
      await logout(page);

      // Try to signup again with same email
      await page.goto('/signup');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.fill('input[name="confirmPassword"]', user.password);
      await page.click('button[type="submit"]');

      // Should show error that user already exists
      await expect(page.locator('text=/user already exists|email already registered/i')).toBeVisible();
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      // First create an account
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Logout
      await logout(page);

      // Login again
      await login(page, user.email, user.password);

      // Should be on dashboard or business page
      await expect(page).toHaveURL(/\/dashboard|\/business/);

      // Should show user is logged in
      const userMenu = page.locator('button[aria-label="User menu"]');
      await expect(userMenu).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');

      // Should show invalid credentials error
      await expect(page.locator('text=/invalid credentials|incorrect email or password/i')).toBeVisible();
    });

    test('should show validation error for empty fields', async ({ page }) => {
      await page.goto('/login');

      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/email.*required|required/i')).toBeVisible();
    });

    test('should redirect to login when accessing protected route', async ({ page }) => {
      // Try to access dashboard without being logged in
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('User Logout', () => {
    test('should successfully logout', async ({ page }) => {
      // Create account and login
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Logout
      await logout(page);

      // Should be on login page
      await expect(page).toHaveURL('/login');

      // Should not be able to access protected routes
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session across page reloads', async ({ page }) => {
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Reload the page
      await page.reload();

      // Should still be logged in
      await expect(page).toHaveURL(/\/dashboard|\/business/);
      const userMenu = page.locator('button[aria-label="User menu"]');
      await expect(userMenu).toBeVisible();
    });
  });

  test.describe('Navigation Links', () => {
    test('should navigate from login to signup', async ({ page }) => {
      await page.goto('/login');

      await page.click('a[href="/signup"]');

      await expect(page).toHaveURL('/signup');
    });

    test('should navigate from signup to login', async ({ page }) => {
      await page.goto('/signup');

      await page.click('a[href="/login"]');

      await expect(page).toHaveURL('/login');
    });
  });
});
