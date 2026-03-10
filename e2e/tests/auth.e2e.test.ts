import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('should complete login flow with valid credentials', async ({ page }) => {
    // Fill email
    await page.fill('input[type="email"]', 'admin@test.com');
    // Fill password
    await page.fill('input[type="password"]', 'AdminPass123!');
    // Click login button
    await page.click('button[type="submit"]');

    // Wait for OTP page
    await expect(page).toHaveURL(/.*otp/);
    expect(await page.isVisible('text=Enter OTP')).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });
});

test.describe('Booking E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'student@test.com');
    await page.fill('input[type="password"]', 'StudentPass123!');
    await page.click('button[type="submit"]');
    // Handle OTP if needed
    await page.waitForURL(/.*dashboard/);
  });

  test('should complete booking flow', async ({ page }) => {
    await page.goto('/rooms');
    // Click on a room
    await page.click('text=Lab A');
    // Select time
    await page.click('[data-testid="time-picker"]');
    // Select duration
    await page.selectOption('[name="duration"]', '2');
    // Click book
    await page.click('button:has-text("Book Room")');
    // Verify booking confirmation
    await expect(page.locator('text=Booking confirmed')).toBeVisible();
  });
});