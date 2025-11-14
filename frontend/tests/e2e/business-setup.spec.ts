import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  generateTestBusiness,
  signup,
  createBusiness,
  assertBusinessCreated,
} from './helpers';

test.describe('Business Profile Setup', () => {
  test.describe('Business Creation', () => {
    test('should successfully create a business profile', async ({ page }) => {
      // Create account first
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Create business
      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Assert business was created
      await assertBusinessCreated(page, business.name);
    });

    test('should show validation errors for required fields', async ({ page }) => {
      // Create account and navigate to business creation
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      await page.goto('/business/new');

      // Try to submit without filling required fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/name.*required|required/i').first()).toBeVisible();
    });

    test('should create business with minimum required fields', async ({ page }) => {
      // Create account
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      await page.goto('/business/new');

      // Fill only required fields
      const businessName = `Minimal Business ${Date.now()}`;
      await page.fill('input[name="name"]', businessName);
      await page.fill('textarea[name="description"]', 'Test description');
      await page.fill('input[name="phone"]', '+1234567890');

      await page.click('button[type="submit"]');

      // Should successfully create business
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator(`text=${businessName}`)).toBeVisible();
    });

    test('should generate slug from business name', async ({ page }) => {
      // Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const businessName = `Test Restaurant ${Date.now()}`;
      await page.goto('/business/new');
      await page.fill('input[name="name"]', businessName);
      await page.fill('textarea[name="description"]', 'Test description');
      await page.fill('input[name="phone"]', '+1234567890');
      await page.click('button[type="submit"]');

      // Navigate to business settings to verify slug
      await page.goto('/business/settings');

      // Should show generated slug (lowercase, hyphenated)
      const expectedSlug = businessName.toLowerCase().replace(/\s+/g, '-');
      await expect(page.locator(`text=/${expectedSlug}/i`)).toBeVisible();
    });
  });

  test.describe('Business Update', () => {
    test('should update business information', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to business settings
      await page.goto('/business/settings');

      // Update business information
      const updatedName = `Updated ${business.name}`;
      await page.fill('input[name="name"]', updatedName);
      await page.fill('textarea[name="description"]', 'Updated description');

      await page.click('button[type="submit"]:has-text("Save")');

      // Should show success message
      await expect(page.locator('text=/saved|updated successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify updated information is displayed
      await expect(page.locator(`input[name="name"][value="${updatedName}"]`)).toBeVisible();
    });

    test('should update delivery settings', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to delivery settings
      await page.goto('/business/settings');

      // Click on delivery settings tab if exists
      const deliveryTab = page.locator('button:has-text("Delivery")');
      if (await deliveryTab.isVisible()) {
        await deliveryTab.click();
      }

      // Update delivery settings
      await page.selectOption('select[name="deliveryFeeType"]', 'flat');
      await page.fill('input[name="deliveryFee"]', '5.00');
      await page.fill('input[name="minOrderAmount"]', '20.00');

      await page.click('button[type="submit"]:has-text("Save")');

      // Should show success message
      await expect(page.locator('text=/saved|updated successfully/i')).toBeVisible({ timeout: 5000 });
    });

    test('should update operating hours', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to operating hours settings
      await page.goto('/business/settings');

      // Click on hours tab if exists
      const hoursTab = page.locator('button:has-text("Hours")');
      if (await hoursTab.isVisible()) {
        await hoursTab.click();
      }

      // Set operating hours for Monday
      await page.check('input[name="monday.isOpen"]');
      await page.fill('input[name="monday.openTime"]', '09:00');
      await page.fill('input[name="monday.closeTime"]', '17:00');

      await page.click('button[type="submit"]:has-text("Save")');

      // Should show success message
      await expect(page.locator('text=/saved|updated successfully/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Business View', () => {
    test('should view business details on dashboard', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Should be on dashboard
      await expect(page).toHaveURL('/dashboard');

      // Should display business information
      await expect(page.locator(`text=${business.name}`)).toBeVisible();
    });

    test('should display business slug for sharing', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to business settings or info page
      await page.goto('/business/settings');

      // Should display the public menu URL with slug
      const expectedSlug = business.name.toLowerCase().replace(/\s+/g, '-');
      await expect(page.locator(`text=/${expectedSlug}/i`)).toBeVisible();
    });
  });

  test.describe('Multiple Business Support', () => {
    test('should allow creating multiple businesses', async ({ page }) => {
      // Setup: Create account
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      // Create first business
      const business1 = generateTestBusiness();
      await createBusiness(page, business1);

      // Navigate to create another business
      await page.goto('/business/new');

      // Create second business
      const business2 = generateTestBusiness();
      await page.fill('input[name="name"]', business2.name);
      await page.fill('textarea[name="description"]', business2.description);
      await page.fill('input[name="phone"]', business2.phone);
      await page.click('button[type="submit"]');

      // Should successfully create second business
      await expect(page).toHaveURL('/dashboard');
    });

    test('should switch between businesses', async ({ page }) => {
      // Setup: Create account and two businesses
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business1 = generateTestBusiness();
      await createBusiness(page, business1);

      await page.goto('/business/new');
      const business2 = generateTestBusiness();
      await page.fill('input[name="name"]', business2.name);
      await page.fill('textarea[name="description"]', business2.description);
      await page.fill('input[name="phone"]', business2.phone);
      await page.click('button[type="submit"]');

      // Look for business switcher dropdown
      const businessSwitcher = page.locator('[data-testid="business-switcher"]');
      if (await businessSwitcher.isVisible()) {
        await businessSwitcher.click();

        // Should see both businesses in the list
        await expect(page.locator(`text=${business1.name}`)).toBeVisible();
        await expect(page.locator(`text=${business2.name}`)).toBeVisible();
      }
    });
  });

  test.describe('Business Profile Image', () => {
    test('should upload business logo', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to business settings
      await page.goto('/business/settings');

      // Find and click the logo upload button
      const uploadButton = page.locator('input[type="file"][accept*="image"]');
      if (await uploadButton.isVisible()) {
        // Create a test image file
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

        await uploadButton.setInputFiles({
          name: 'test-logo.png',
          mimeType: 'image/png',
          buffer: buffer,
        });

        // Should show upload progress or success
        await expect(page.locator('text=/uploading|uploaded successfully/i')).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
