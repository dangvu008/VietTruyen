import { test, expect } from '@playwright/test';

test.describe('Auth & Global Features', () => {
  test('Đăng nhập bằng quyền Khách và truy cập Dashboard', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for the login screen and check its title
    await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();

    // Click "Khám phá với chế độ khách"
    const guestButton = page.locator('button:has-text("Khám phá với chế độ khách")');
    await expect(guestButton).toBeVisible();
    await guestButton.click();

    // After login, we should see the dashboard. Wait for "Tác phẩm mới" button.
    const newProjectBtn = page.locator('button:has-text("Tác phẩm mới")');
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });

    // Verify some text or element from dashboard
    await expect(page.getByRole('heading', { name: 'Thống Kê Viết' })).toBeVisible();
  });

  test('Kiểm tra Settings (Giao diện, Ngôn ngữ)', async ({ page }) => {
    await page.goto('/');
    
    // Login as guest
    await page.locator('button:has-text("Khám phá với chế độ khách")').click();
    await expect(page.locator('button:has-text("Tác phẩm mới")')).toBeVisible({ timeout: 10000 });

    // Click on AI & Runtime to open settings
    const settingsButton = page.getByRole('button', { name: /AI & Runtime/i });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    
    // Once settings are open, check for a tab like "Giao Diện"
    await expect(page.getByRole('button', { name: /Giao Diện/i })).toBeVisible();
  });
});
