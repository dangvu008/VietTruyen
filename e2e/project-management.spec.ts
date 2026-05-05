import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage and login as Guest
    await page.goto('/');
    await page.locator('button:has-text("Khám phá với chế độ khách")').click();
    await expect(page.getByRole('heading', { name: 'Thống Kê Viết' })).toBeVisible({ timeout: 10000 });
  });

  test('Khởi tạo dự án mới chuyển hướng đến trang Sáng tác', async ({ page }) => {
    // Click "Kho truyện" in the sidebar
    await page.locator('button', { hasText: 'Kho truyện' }).click();
    await expect(page.getByRole('heading', { name: 'Kho Truyện Của Tôi' })).toBeVisible();

    // Click "Tác phẩm mới"
    await page.locator('button:has-text("Tác phẩm mới")').click();

    // The modal should appear
    const modalHeading = page.getByRole('heading', { name: 'Tạo tác phẩm mới' });
    await expect(modalHeading).toBeVisible();

    // Fill in the title
    await page.getByPlaceholder('Ví dụ: Sương Rơi').fill('[E2E-Test] Dự án khởi tạo');

    // Click submit "Tạo tác phẩm"
    await page.getByRole('button', { name: 'Tạo tác phẩm', exact: true }).click();

    // Verify redirection to Creation Chat ("Sáng tác mới" header)
    await expect(page.getByText('Sáng tác mới')).toBeVisible({ timeout: 10000 });
  });

  test('Truy cập workspace và Xóa dự án (Inject qua localStorage)', async ({ page }) => {
    // Inject a fake project into localStorage
    const fakeProjectId = randomUUID();
    const fakeProject = {
      id: fakeProjectId,
      title: '[E2E-Test] Tác phẩm Mock',
      logline: 'Một câu chuyện mock để test.',
      genre: 'Mock Genre',
      subGenre: [],
      writingStyle: '',
      tone: '',
      styleId: '',
      targetChapters: 60,
      endgame: '',
      mainCharacterCount: 2,
      supportCharacterCount: 3,
      characterSetup: '',
      worldSetting: '',
      mainPlot: '',
      world: {
        geography: '',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
        facts: [],
      },
      characters: [],
      outline: [],
      chapters: [],
      foreshadowings: [],
      notes: '',
      canonVersion: 1,
      storageMode: 'inline',
      arcCount: 0,
      hasGlobalIndex: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await page.evaluate((projectStr) => {
      const existingDataStr = localStorage.getItem('viettruyen-projects');
      let state = { projects: [], activeProjectId: null };
      if (existingDataStr) {
        try {
          const parsed = JSON.parse(existingDataStr);
          if (parsed && parsed.state) state = parsed.state;
        } catch (e) {}
      }
      state.projects.push(JSON.parse(projectStr));
      localStorage.setItem('viettruyen-projects', JSON.stringify({ state, version: 0 }));
    }, JSON.stringify(fakeProject));

    // Reload to apply localStorage
    await page.reload();

    // Because auth store is not persisted, we need to login as guest again after reload
    await page.locator('button:has-text("Khám phá với chế độ khách")').click();
    await expect(page.getByRole('heading', { name: 'Thống Kê Viết' })).toBeVisible({ timeout: 10000 });

    // Go to "Kho truyện"
    await page.locator('button', { hasText: 'Kho truyện' }).click();

    // The mock project should be visible
    const projectCard = page.locator('h3', { hasText: '[E2E-Test] Tác phẩm Mock' });
    await expect(projectCard).toBeVisible();

    // Click the project to enter workspace
    await projectCard.click();

    // It should open the workspace, verify "Kinh Thánh" or "Cốt truyện"
    await expect(page.getByRole('heading', { name: '[E2E-Test] Tác phẩm Mock' })).toBeVisible();

    // Now let's go back to Kho truyện to delete it
    // Click "Kho Truyện" on the Project Sidebar to exit workspace
    await page.locator('p', { hasText: 'Kho Truyện' }).click();
    await expect(page.getByRole('heading', { name: 'Kho Truyện Của Tôi' })).toBeVisible();
    // The trash button is a Trash2 icon inside the project card.
    const deleteBtn = page.locator('.group').filter({ hasText: '[E2E-Test] Tác phẩm Mock' }).locator('button').first();
    await deleteBtn.click({ force: true }); // force click because it appears on hover

    // Confirm deletion if there is a confirm dialog
    page.once('dialog', dialog => dialog.accept());

    // Verify it's gone
    await expect(projectCard).not.toBeVisible();
  });
});
