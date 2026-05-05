import { describe, expect, it, vi } from 'vitest';
import type { StoryTemplate } from '../../types/story_template';
import { resolveExtractedTemplateFromSource } from './shared_template_registry';
import { createSharedTemplateSourceFingerprint } from './shared_template_fingerprint';

function createTemplate(id: string, name: string): StoryTemplate {
  return {
    id,
    name,
    coreSellingPoint: `${name} USP`,
    tags: ['custom', 'extracted'],
    subGenres: [],
    worldRules: [],
    coolPatterns: [],
    conflictPatterns: [],
    outlineArcs: [],
    pitfalls: [],
    bestPractices: [],
    entityTags: [],
  };
}

describe('shared_template_registry', () => {
  it('reuses an existing shared template before calling the extractor', async () => {
    const extractTemplateFromText = vi.fn(async () => createTemplate('fresh-local', 'Fresh Local'));
    const existingTemplate = createTemplate('shared-existing', 'Shared Existing');
    const findSharedTemplateBySourceFingerprint = vi.fn(async () => ({
      id: 'row-1',
      userId: 'user-1',
      sourceTitle: 'Phàm Nhân',
      sourceFingerprint: createSharedTemplateSourceFingerprint('Phàm Nhân', 'Noi dung goc'),
      template: existingTemplate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const result = await resolveExtractedTemplateFromSource(
      {
        sourceTitle: 'Phàm Nhân',
        sourceText: 'Noi dung goc',
        shareByDefault: true,
        userId: 'user-2',
      },
      {
        extractTemplateFromText,
        findSharedTemplateBySourceFingerprint,
      },
    );

    expect(findSharedTemplateBySourceFingerprint).toHaveBeenCalledTimes(1);
    expect(extractTemplateFromText).not.toHaveBeenCalled();
    expect(result.reusedSharedTemplate).toBe(true);
    expect(result.template).toMatchObject({
      id: 'shared-existing',
      sharing: {
        visibility: 'shared',
        sourceTitle: 'Phàm Nhân',
      },
    });
  });

  it('publishes a shared template when none exists for the same source', async () => {
    const extractedTemplate = createTemplate('local-new', 'Local New');
    const extractTemplateFromText = vi.fn(async () => extractedTemplate);
    const findSharedTemplateBySourceFingerprint = vi.fn(async () => null);
    const publishSharedTemplate = vi.fn(async ({ template, sourceFingerprint, sourceTitle, userId }) => ({
      id: 'shared-row-2',
      userId,
      sourceTitle,
      sourceFingerprint,
      template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const result = await resolveExtractedTemplateFromSource(
      {
        sourceTitle: 'Thiên Hà',
        sourceText: 'Chuoi noi dung',
        shareByDefault: true,
        userId: 'user-9',
      },
      {
        extractTemplateFromText,
        findSharedTemplateBySourceFingerprint,
        publishSharedTemplate,
      },
    );

    expect(extractTemplateFromText).toHaveBeenCalledTimes(1);
    expect(publishSharedTemplate).toHaveBeenCalledTimes(1);
    expect(result.publishedSharedTemplate).toBe(true);
    expect(result.template.sharing).toMatchObject({
      visibility: 'shared',
      sourceTitle: 'Thiên Hà',
      sharedTemplateId: 'shared-row-2',
      sharedByUserId: 'user-9',
    });
  });

  it('falls back to a private local template when sharing is requested without a logged-in user', async () => {
    const extractTemplateFromText = vi.fn(async () => createTemplate('private-only', 'Private Only'));

    const result = await resolveExtractedTemplateFromSource(
      {
        sourceTitle: 'Ẩn Danh',
        sourceText: 'Van ban',
        shareByDefault: true,
        userId: null,
      },
      {
        extractTemplateFromText,
      },
    );

    expect(result.shareRequested).toBe(true);
    expect(result.publishedSharedTemplate).toBe(false);
    expect(result.template.sharing).toMatchObject({
      visibility: 'private',
      sourceTitle: 'Ẩn Danh',
    });
  });
});
