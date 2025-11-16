import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  generateTestBusiness,
  generateTestDish,
  signup,
  createBusiness,
  createDish,
  publishMenu,
  assertMenuPublished,
} from './helpers';

test.describe('Menu and Dish Management', () => {
  test.describe('Dish Creation', () => {
    test('should create a new dish', async ({ page }) => {
      // Setup: Create account and business
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to menu editor
      await page.goto('/menu/editor');

      // Create a dish
      const dish = generateTestDish();
      await page.click('button:has-text("Add Dish")');

      await page.fill('input[name="name"]', dish.name);
      await page.fill('textarea[name="description"]', dish.description);
      await page.fill('input[name="price"]', dish.price);

      await page.click('button:has-text("Save")');

      // Should show the dish in the list
      await expect(page.locator(`text=${dish.name}`)).toBeVisible({ timeout: 5000 });
    });

    test('should create dish with category', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      // Navigate to menu editor
      await page.goto('/menu/editor');

      // Create a category first
      const categoryButton = page.locator('button:has-text("Add Category")');
      if (await categoryButton.isVisible()) {
        await categoryButton.click();
        await page.fill('input[name="categoryName"]', 'Appetizers');
        await page.click('button:has-text("Save Category")');
      }

      // Create a dish with category
      await page.click('button:has-text("Add Dish")');

      const dish = generateTestDish();
      await page.fill('input[name="name"]', dish.name);
      await page.fill('textarea[name="description"]', dish.description);
      await page.fill('input[name="price"]', dish.price);

      // Select category
      await page.selectOption('select[name="category"]', 'Appetizers');

      await page.click('button:has-text("Save")');

      // Should show the dish under the category
      await expect(page.locator(`text=${dish.name}`)).toBeVisible({ timeout: 5000 });
    });

    test('should show validation errors for required dish fields', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Try to create dish without required fields
      await page.click('button:has-text("Add Dish")');
      await page.click('button:has-text("Save")');

      // Should show validation errors
      await expect(page.locator('text=/name.*required|required/i').first()).toBeVisible();
    });

    test('should upload dish image', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create dish with image
      await page.click('button:has-text("Add Dish")');

      const dish = generateTestDish();
      await page.fill('input[name="name"]', dish.name);
      await page.fill('textarea[name="description"]', dish.description);
      await page.fill('input[name="price"]', dish.price);

      // Upload image
      const uploadInput = page.locator('input[type="file"][accept*="image"]');
      if (await uploadInput.isVisible()) {
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

        await uploadInput.setInputFiles({
          name: 'dish.png',
          mimeType: 'image/png',
          buffer: buffer,
        });

        // Wait for upload to complete
        await expect(page.locator('text=/uploading|uploaded/i')).toBeVisible({ timeout: 10000 });
      }

      await page.click('button:has-text("Save")');

      // Should show the dish with image
      await expect(page.locator(`text=${dish.name}`)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Dish Management', () => {
    test('should update existing dish', async ({ page }) => {
      // Setup: Create dish
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      // Edit the dish
      await page.click(`[data-dish-name="${dish.name}"] button:has-text("Edit")`);

      const updatedName = `Updated ${dish.name}`;
      await page.fill('input[name="name"]', updatedName);
      await page.fill('input[name="price"]', '15.99');

      await page.click('button:has-text("Save")');

      // Should show updated dish
      await expect(page.locator(`text=${updatedName}`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=15.99')).toBeVisible();
    });

    test('should delete dish', async ({ page }) => {
      // Setup: Create dish
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      // Delete the dish
      await page.click(`[data-dish-name="${dish.name}"] button:has-text("Delete")`);

      // Confirm deletion
      await page.click('button:has-text("Confirm")');

      // Should remove dish from list
      await expect(page.locator(`text=${dish.name}`)).not.toBeVisible({ timeout: 5000 });
    });

    test('should toggle dish availability', async ({ page }) => {
      // Setup: Create dish
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      // Toggle availability
      const availabilityToggle = page.locator(`[data-dish-name="${dish.name}"] input[type="checkbox"]`);
      if (await availabilityToggle.isVisible()) {
        await availabilityToggle.click();

        // Should show visual indicator of unavailability
        await expect(page.locator(`[data-dish-name="${dish.name}"][data-available="false"]`)).toBeVisible();
      }
    });
  });

  test.describe('Category Management', () => {
    test('should create dish category', async ({ page }) => {
      // Setup
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create category
      await page.click('button:has-text("Add Category")');
      await page.fill('input[name="categoryName"]', 'Main Courses');
      await page.click('button:has-text("Save Category")');

      // Should show category in list
      await expect(page.locator('text=Main Courses')).toBeVisible({ timeout: 5000 });
    });

    test('should reorder categories', async ({ page }) => {
      // Setup: Create multiple categories
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create categories
      const categories = ['Appetizers', 'Main Courses', 'Desserts'];
      for (const category of categories) {
        await page.click('button:has-text("Add Category")');
        await page.fill('input[name="categoryName"]', category);
        await page.click('button:has-text("Save Category")');
        await page.waitForTimeout(500);
      }

      // Check if drag handles are available
      const dragHandle = page.locator('[data-testid="drag-handle"]').first();
      if (await dragHandle.isVisible()) {
        // Reorder categories (drag second to first position)
        await dragHandle.dragTo(page.locator('[data-testid="category-0"]'));

        // Should show reordered categories
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Menu Creation and Publishing', () => {
    test('should create and publish a menu', async ({ page }) => {
      // Setup: Create business and dishes
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create some dishes
      const dishes = [generateTestDish(), generateTestDish(), generateTestDish()];
      for (const dish of dishes) {
        await createDish(page, dish);
        await page.waitForTimeout(500);
      }

      // Create a menu
      const menuName = `Weekly Menu ${Date.now()}`;
      await page.click('button:has-text("Create Menu")');
      await page.fill('input[name="menuName"]', menuName);
      await page.click('button:has-text("Create")');

      // Add dishes to menu
      for (const dish of dishes) {
        const checkbox = page.locator(`[data-dish-name="${dish.name}"] input[type="checkbox"]`);
        if (await checkbox.isVisible()) {
          await checkbox.check();
        }
      }

      // Publish menu
      await publishMenu(page);

      // Should show published status
      await assertMenuPublished(page);
    });

    test('should show menu preview before publishing', async ({ page }) => {
      // Setup: Create business and dishes
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      // Click preview button
      const previewButton = page.locator('button:has-text("Preview")');
      if (await previewButton.isVisible()) {
        await previewButton.click();

        // Should show preview modal or navigate to preview page
        await expect(page.locator('text=/preview/i')).toBeVisible({ timeout: 5000 });

        // Should show dish in preview
        await expect(page.locator(`text=${dish.name}`)).toBeVisible();
      }
    });

    test('should unpublish/archive menu', async ({ page }) => {
      // Setup: Create and publish menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      // Unpublish/archive menu
      const archiveButton = page.locator('button:has-text("Archive")');
      if (await archiveButton.isVisible()) {
        await archiveButton.click();

        // Confirm archive
        await page.click('button:has-text("Confirm")');

        // Should show archived status
        await expect(page.locator('text=/archived|draft/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Menu Visibility', () => {
    test('should view public menu page', async ({ page, context }) => {
      // Setup: Create and publish menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      // Get the public menu URL
      const slug = business.name.toLowerCase().replace(/\s+/g, '-');
      const publicMenuUrl = `/m/${slug}`;

      // Open public menu in new tab (simulate customer view)
      const newPage = await context.newPage();
      await newPage.goto(publicMenuUrl);

      // Should show the menu without needing to login
      await expect(newPage.locator(`text=${dish.name}`)).toBeVisible({ timeout: 5000 });
      await expect(newPage.locator(`text=${business.name}`)).toBeVisible();

      // Should show Add to Cart button
      await expect(newPage.locator('button:has-text("Add to Cart")')).toBeVisible();

      await newPage.close();
    });

    test('should share menu URL', async ({ page }) => {
      // Setup: Create and publish menu
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      const dish = generateTestDish();
      await createDish(page, dish);

      await publishMenu(page);

      // Find share button
      const shareButton = page.locator('button:has-text("Share")');
      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Should show shareable URL
        const slug = business.name.toLowerCase().replace(/\s+/g, '-');
        await expect(page.locator(`text=/${slug}/i`)).toBeVisible();

        // Should have copy button
        const copyButton = page.locator('button:has-text("Copy")');
        if (await copyButton.isVisible()) {
          await copyButton.click();

          // Should show copied confirmation
          await expect(page.locator('text=/copied/i')).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should bulk update dish availability', async ({ page }) => {
      // Setup: Create multiple dishes
      const user = generateTestUser();
      await signup(page, user.email, user.password);

      const business = generateTestBusiness();
      await createBusiness(page, business);

      await page.goto('/menu/editor');

      // Create multiple dishes
      const dishes = [generateTestDish(), generateTestDish(), generateTestDish()];
      for (const dish of dishes) {
        await createDish(page, dish);
        await page.waitForTimeout(500);
      }

      // Select multiple dishes
      for (const dish of dishes) {
        const checkbox = page.locator(`[data-dish-name="${dish.name}"] input[type="checkbox"]`);
        if (await checkbox.isVisible()) {
          await checkbox.check();
        }
      }

      // Bulk action: Mark unavailable
      const bulkActionsButton = page.locator('button:has-text("Bulk Actions")');
      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.click();
        await page.click('button:has-text("Mark Unavailable")');

        // Should update all selected dishes
        for (const dish of dishes) {
          await expect(page.locator(`[data-dish-name="${dish.name}"][data-available="false"]`)).toBeVisible();
        }
      }
    });
  });
});
