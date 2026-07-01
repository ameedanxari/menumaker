import { test, expect } from '@playwright/test';
import { generateTestUser, signup, login, logout } from './helpers';

test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test.describe('User Signup', () => {
    test('should successfully create a new account', async ({ page }) => {
      const user = generateTestUser();

      await signup(page, user.email, user.password);

      // Should redirect to business setup or dashboard
      await expect(page).toHaveURL(/\/business\/new|\/dashboard/);

      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for invalid email', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.fill('input[name="confirmPassword"]', 'Test123456!');
      await page.click('button[type="submit"]');

      const emailValidationMessage = await page.locator('input[name="email"]').evaluate((input) => {
        return (input as HTMLInputElement).validationMessage;
      });
      expect(emailValidationMessage).toMatch(/invalid|email|include an '@'/i);
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

      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
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

      const emailValidationMessage = await page.locator('input[name="email"]').evaluate((input) => {
        return (input as HTMLInputElement).validationMessage;
      });
      expect(emailValidationMessage).toMatch(/fill out|required/i);
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
    test('should require re-authentication after page reload without persisted bearer token', async ({ page }) => {
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Reload the page
      await page.reload();

      // Access tokens are intentionally memory-only; a reload must not silently persist auth.
      await expect(page).toHaveURL(/\/login/);
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

  test.describe('Admin Portal', () => {
    test('should not expose the admin portal to a regular authenticated user', async ({ page }) => {
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      await expect(page.getByRole('link', { name: 'Admin Portal' })).toHaveCount(0);

      await page.evaluate(() => {
        window.history.pushState({}, '', '/admin');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByRole('heading', { name: 'Admin Portal' })).toHaveCount(0);
    });

    test('should expose first-party admin route to operators and load admin API evidence', async ({ page }) => {
      const user = {
        email: `support.operator-${Date.now()}-${Math.random().toString(36).substring(7)}@example.test`,
        password: 'Test123456!',
      };
      await signup(page, user.email, user.password);

      await expect(page.getByRole('link', { name: 'Admin Portal' })).toBeVisible();
      await page.getByRole('link', { name: 'Admin Portal' }).click();
      await expect(page).toHaveURL('/admin');

      await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
      await expect(page.getByText('First-party operator surface for the existing admin APIs')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Platform Analytics' })).toBeVisible();

      await expect(page.getByText('support.operator@example.test')).toBeVisible();
      await expect(page.getByText('menu_image_review')).toBeVisible();
      await expect(page.getByText('Launch readiness review')).toBeVisible();
      await expect(page.getByText('admin_portal')).toBeVisible();
      await expect(page.getByText('ocr_menu_import', { exact: true })).toBeVisible();
    });
  });
});
