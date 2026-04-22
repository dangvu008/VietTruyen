/**
 * File: adaptation_preview_project.ts
 * Purpose: Build/promote preview projects for upload-first adaptation flow
 * Layer: Application
 * Domain: Adaptation → [preview project, upload analysis]
 */

import { createId } from '../../core/id';
import { parseRawTextToChapters } from '../surgery/source_ingest';
import type { AdaptationConfig } from '../../types/adaptation';
import type { Project } from '../../types/story';

export function buildAdaptationPreviewProject(params: {
  title: string;
  text: string;
}): Project {
  const now = new Date().toISOString();
  const trimmedTitle = params.title.trim() || 'Bản thảo vô danh';
  const chapters = parseRawTextToChapters(params.text);

  return {
    id: createId(),
    title: trimmedTitle,
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: chapters.length || 60,
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
    chapters,
    foreshadowings: [],
    notes: '[Nguồn tải lên: văn bản thô]',
    canonVersion: 1,
    storageMode: chapters.length > 0 ? 'indexeddb' : 'inline',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function finalizeAdaptationPreviewProject(
  previewProject: Project,
  config: AdaptationConfig,
): Project {
  const sourceTitle = previewProject.title || 'Bản thảo vô danh';
  const now = new Date().toISOString();

  return {
    ...previewProject,
    title: config.newTitle || `${sourceTitle} — Phóng tác`,
    genre: config.newGenre || previewProject.genre || 'Kỳ ảo',
    styleId: config.newStyleId || previewProject.styleId || 'tien-hiep',
    writingStyle: previewProject.writingStyle || 'Văn phong đẹp, ý cảnh sâu xa',
    tone: previewProject.tone || 'Trang trọng, kỳ ảo',
    targetChapters: previewProject.chapters.length || previewProject.targetChapters || 60,
    notes: config.userNotes
      ? `[Phóng tác từ "${sourceTitle}"]\n${config.userNotes}`
      : `[Phóng tác từ "${sourceTitle}"]`,
    adaptationType: config.adaptationType,
    updatedAt: now,
  };
}
