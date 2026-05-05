import { test, expect } from '@playwright/test';

test.describe('Editor & Writer Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to root to set localStorage
    await page.goto('/');

    // Inject Guest Auth and a Mock Project with an empty chapter list
    await page.evaluate(() => {
      // 1. Mock Auth
      localStorage.setItem('viettruyen-auth', JSON.stringify({
        state: {
          user: {
            id: 'guest-123',
            email: 'guest@local',
            user_metadata: { name: 'Guest User' }
          },
          session: {
            access_token: 'fake-guest-token',
            refresh_token: 'fake-guest-token',
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
            user: { id: 'guest-123', email: 'guest@local', user_metadata: { name: 'Guest User' } }
          },
          isGuest: true
        },
        version: 0
      }));

      // 2. Mock Project
      const mockProject = {
        id: 'editor-test-project',
        title: '[E2E-Test] Truyện Editor',
        logline: 'Dự án để test Editor workspace',
        genre: 'Fantasy',
        subGenre: [],
        writingStyle: '',
        tone: 'serious',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem('viettruyen-projects', JSON.stringify({
        state: {
          projects: [mockProject],
          activeProjectId: 'editor-test-project'
        },
        version: 0
      }));
    });

    // Reload to apply injected state
    await page.reload();

    // Guest login (required because auth state is not fully persisted)
    await page.locator('button:has-text("Khám phá với chế độ khách")').click();
    await expect(page.getByRole('heading', { name: 'Thống Kê Viết' })).toBeVisible({ timeout: 10000 });

    // Go to "Kho truyện"
    await page.locator('button', { hasText: 'Kho truyện' }).click();
  });

  test('Tạo chương mới, nhập nội dung và kiểm tra lưu trữ', async ({ page }) => {
    // 1. Enter the project workspace
    const projectCard = page.locator('h3', { hasText: '[E2E-Test] Truyện Editor' });
    await expect(projectCard).toBeVisible();
    await projectCard.click();

    // Verify we are inside the workspace
    await expect(page.getByRole('heading', { name: '[E2E-Test] Truyện Editor' })).toBeVisible();

    // 2. Go to the "Viết tiếp" tab if not already there
    const writeTabBtn = page.locator('nav button', { hasText: 'Viết tiếp' });
    await writeTabBtn.click();

    // Wait for the right panel to appear
    await expect(page.getByRole('button', { name: 'Mục lục' })).toBeVisible({ timeout: 5000 });

    // In the Right Panel (AIAssistantPanel), switch to "Mục lục" tab
    const rightPanelChapterTab = page.getByRole('button', { name: 'Mục lục' });
    await rightPanelChapterTab.click();

    // 3. Create a new chapter
    const newChapterBtn = page.locator('button', { hasText: 'Tạo chương mới' });
    await expect(newChapterBtn).toBeVisible();
    await newChapterBtn.click();

    // Ensure the new chapter is listed in the sidebar
    const chapterItem = page.locator('p', { hasText: 'Chương 1' }).first();
    await expect(chapterItem).toBeVisible();

    // 4. Edit the chapter title
    // The title is a textarea with placeholder "Tên chương..."
    const titleInput = page.getByPlaceholder('Tên chương...');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Chương 1: Khởi nguồn của thế giới (E2E)');

    // 5. Edit the chapter content
    // The content is a textarea with placeholder "Bắt đầu viết chương..." or similar
    // Based on the code, there's a textarea next to the sidebar
    // We can target the main content textarea by filtering for `textarea` not having the placeholder "Tên chương..."
    // Let's use getByPlaceholder if we know it, or just use the second textarea
    const contentTextarea = page.locator('textarea:not([placeholder="Tên chương..."])').first();
    await expect(contentTextarea).toBeVisible();
    
    const testContent = 'Đây là nội dung thử nghiệm từ E2E test. Hôm nay là một ngày đẹp trời.';
    await contentTextarea.fill(testContent);

    // 6. Verify the sidebar updates to show "Đã viết" or similar badge if dirty
    // Or just click to another tab and back to ensure autosave
    await page.waitForTimeout(1000); // Wait for debounce / react state

    // Navigate to "Dàn ý" tab
    await page.locator('button', { hasText: 'Dàn ý' }).or(page.locator('div', { hasText: 'Dàn ý' })).first().click();
    await expect(page.getByText('Dàn ý')).toBeVisible();

    // Navigate back to "Viết tiếp" tab
    await writeTabBtn.first().click();

    // The content should still be there because it autosaves to local storage or IndexedDB
    await expect(titleInput).toHaveValue('Chương 1: Khởi nguồn của thế giới (E2E)');
    await expect(contentTextarea).toHaveValue(testContent);
  });
});
