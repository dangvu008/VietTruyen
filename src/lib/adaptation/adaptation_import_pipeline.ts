/**
 * File: adaptation_import_pipeline.ts
 * Purpose: Canonical upload-first adaptation pipeline for parse -> preprocess -> preview -> analyze -> config
 * Layer: Application
 * Domain: Adaptation → [source intake, preview analysis, import profile]
 */

import { getEntityDefinitions, getProjectMemoryEmbeddings, getProjectNarrativeCommunities, getProjectNarrativeEdges, getProjectNarrativeNodes } from '../../db/narrative_db';
import { parseDocument, preprocessTextForLlmInput, type LlmInputPreprocessStats, type ParsedDocument } from '../document';
import { syncProjectMemoryBridge } from '../memory/memory_sync_bridge';
import { buildAdaptationPreviewProject } from './adaptation_preview_project';
import type { AdaptationConfig, AdaptationType } from '../../types/adaptation';
import type { Project } from '../../types/story';

export type AdaptationSourceRole = 'main_draft' | 'reference';
export type AdaptationRewriteStrength = 'light' | 'balanced' | 'bold';
export type AdaptationStartPoint = 'chapter_1' | 'continue_after_import';

export interface AdaptationSourceDraft {
  title: string;
  text: string;
  inputStats: LlmInputPreprocessStats;
  parsedDocument: ParsedDocument;
  previewProject: Project;
}

export interface AdaptationAnalysisStats {
  chapterCount: number;
  entityCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  communityCount: number;
  embeddingCount: number;
}

export interface AdaptationAnalysisResult {
  stats: AdaptationAnalysisStats;
  readyMessage: string;
}

export interface AdaptationImportProfileDraft {
  sourceTitle: string;
  sourceText: string;
  newTitle: string;
  prompt: string;
  sourceRole: AdaptationSourceRole;
  rewriteStrength: AdaptationRewriteStrength;
  startPoint: AdaptationStartPoint;
  adaptationType?: AdaptationType;
  newGenre?: string;
  newStyleId?: string;
}

interface PrepareAdaptationSourceDraftDeps {
  parseDocument?: typeof parseDocument;
  preprocessTextForLlmInput?: typeof preprocessTextForLlmInput;
  buildAdaptationPreviewProject?: typeof buildAdaptationPreviewProject;
}

interface AnalyzeAdaptationPreviewProjectDeps {
  syncProjectMemoryBridge?: typeof syncProjectMemoryBridge;
  getEntityDefinitions?: typeof getEntityDefinitions;
  getProjectNarrativeNodes?: typeof getProjectNarrativeNodes;
  getProjectNarrativeEdges?: typeof getProjectNarrativeEdges;
  getProjectNarrativeCommunities?: typeof getProjectNarrativeCommunities;
  getProjectMemoryEmbeddings?: typeof getProjectMemoryEmbeddings;
}

const REWRITE_STRENGTH_LABELS: Record<AdaptationRewriteStrength, string> = {
  light: 'nhẹ - giữ sát canon',
  balanced: 'vừa - giữ trục chính, viết lại nhịp và giọng',
  bold: 'mạnh - cho phép rẽ nhánh rõ rệt',
};

const START_POINT_LABELS: Record<AdaptationStartPoint, string> = {
  chapter_1: 'tạo lại từ chương 1',
  continue_after_import: 'viết tiếp sau nội dung đã nhập',
};

const SOURCE_ROLE_LABELS: Record<AdaptationSourceRole, string> = {
  main_draft: 'bản chính để lập hồ sơ phóng tác',
  reference: 'nguồn tham chiếu để học canon/văn phong',
};

export async function prepareAdaptationSourceDraft(
  file: File,
  options?: {
    onParseProgress?: (message: string) => void;
  },
  deps: PrepareAdaptationSourceDraftDeps = {},
): Promise<AdaptationSourceDraft> {
  const parseDocumentImpl = deps.parseDocument ?? parseDocument;
  const preprocessTextForLlmInputImpl = deps.preprocessTextForLlmInput ?? preprocessTextForLlmInput;
  const buildAdaptationPreviewProjectImpl =
    deps.buildAdaptationPreviewProject ?? buildAdaptationPreviewProject;

  const parsedDocument = await parseDocumentImpl(file, {
    onProgress: options?.onParseProgress,
  });
  const preprocessed = preprocessTextForLlmInputImpl(parsedDocument.text);
  const text = preprocessed.cleanText || parsedDocument.text;
  const title = parsedDocument.title || file.name.replace(/\.[^.]+$/, '') || 'Bản thảo vô danh';
  const previewProject = buildAdaptationPreviewProjectImpl({ title, text });

  return {
    title,
    text,
    inputStats: preprocessed.stats,
    parsedDocument,
    previewProject,
  };
}

export async function analyzeAdaptationPreviewProject(
  previewProject: Project,
  options?: {
    onProgress?: (processed: number, total: number) => void;
  },
  deps: AnalyzeAdaptationPreviewProjectDeps = {},
): Promise<AdaptationAnalysisResult> {
  const syncProjectMemoryBridgeImpl = deps.syncProjectMemoryBridge ?? syncProjectMemoryBridge;
  const getEntityDefinitionsImpl = deps.getEntityDefinitions ?? getEntityDefinitions;
  const getProjectNarrativeNodesImpl = deps.getProjectNarrativeNodes ?? getProjectNarrativeNodes;
  const getProjectNarrativeEdgesImpl = deps.getProjectNarrativeEdges ?? getProjectNarrativeEdges;
  const getProjectNarrativeCommunitiesImpl =
    deps.getProjectNarrativeCommunities ?? getProjectNarrativeCommunities;
  const getProjectMemoryEmbeddingsImpl =
    deps.getProjectMemoryEmbeddings ?? getProjectMemoryEmbeddings;

  await syncProjectMemoryBridgeImpl(previewProject, {
    onProgress: options?.onProgress,
  });

  const [definitions, nodes, edges, communities, embeddings] = await Promise.all([
    getEntityDefinitionsImpl(previewProject.id),
    getProjectNarrativeNodesImpl(previewProject.id),
    getProjectNarrativeEdgesImpl(previewProject.id),
    getProjectNarrativeCommunitiesImpl(previewProject.id),
    getProjectMemoryEmbeddingsImpl(previewProject.id),
  ]);

  const stats: AdaptationAnalysisStats = {
    chapterCount: previewProject.chapters.length,
    entityCount: definitions.length,
    graphNodeCount: nodes.length,
    graphEdgeCount: edges.length,
    communityCount: communities.length,
    embeddingCount: embeddings.length,
  };

  return {
    stats,
    readyMessage: buildAdaptationAnalysisReadyMessage(stats),
  };
}

export function buildAdaptationAnalysisReadyMessage(stats: AdaptationAnalysisStats): string {
  return `Memory đã sẵn sàng: ${stats.chapterCount} chương, ${stats.entityCount} entity defs, ${stats.embeddingCount} embedding chunks.`;
}

export function buildAdaptationUserNotes(profile: Omit<AdaptationImportProfileDraft, 'newTitle' | 'sourceTitle' | 'sourceText' | 'adaptationType' | 'newGenre' | 'newStyleId'>): string {
  return [
    `Vai trò file nhập: ${SOURCE_ROLE_LABELS[profile.sourceRole]}.`,
    `Mức sáng tạo: ${REWRITE_STRENGTH_LABELS[profile.rewriteStrength]}.`,
    `Điểm bắt đầu: ${START_POINT_LABELS[profile.startPoint]}.`,
    profile.prompt.trim() ? `Yêu cầu người dùng: ${profile.prompt.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAdaptationConfigFromDraft(
  draft: AdaptationImportProfileDraft,
): AdaptationConfig {
  return {
    uploadedSource: {
      title: draft.sourceTitle.trim() || 'Bản thảo vô danh',
      text: draft.sourceText.trim(),
      isSummary: false,
    },
    adaptationType: draft.adaptationType ?? 'reskin',
    newTitle: draft.newTitle,
    newGenre: draft.newGenre ?? 'Kỳ ảo',
    newStyleId: draft.newStyleId ?? 'tien-hiep',
    keepCharacters: 'none',
    selectedCharacterIds: [],
    keepWorld: false,
    keepOutline: false,
    keepForeshadowings: false,
    userNotes: buildAdaptationUserNotes({
      prompt: draft.prompt,
      sourceRole: draft.sourceRole,
      rewriteStrength: draft.rewriteStrength,
      startPoint: draft.startPoint,
    }),
  };
}
