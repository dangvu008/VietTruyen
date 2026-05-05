import { test, expect } from '@playwright/test';

test('Trang chủ VietTruyen tải thành công', async ({ page }) => {
  // Điều hướng đến ứng dụng đang chạy ở port 1420
  await page.goto('http://localhost:1420/');

  // Kiểm tra tiêu đề của trang
  await expect(page).toHaveTitle(/VietTruyen/);
});
