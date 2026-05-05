/**
 * File: context_builder.ts
 * Purpose: Xây dựng context tối ưu cho AI viết chương và surprise engine.
 *          Tích hợp Scene-Type Selective Loading (MemPalace L0→L3 concept)
 *          và Project Identity Block (~200 tokens wake-up).
 */
import type { Project, Character, OutlineBeat, Foreshadowing } from '../../types/story';
import type { StyleRule } from '../../types/style_learning';
import type {
  AnchorSet,
  ExpectationProfile,
  SurpriseBranch,
  TensionLevel,
} from '../../types/surprise';
import { quickTruncate } from './token_estimator';
import { buildStyleGuideSection } from './style_learner';
import { getChaptersChronological } from './surprise_engine';
import { injectTemplateToWriterPrompt } from './template_injector';
import {
  buildTemporalProjectView,
  getClusterAwareNarrativeState,
  getContinuityWarnings,
  getEntityTimelineSnapshots,
} from '../memory/memory_query';
import type { EntitySnapshot } from '../../types/narrative_memory';
import { extractTimeConstraints } from './time_constraint_tracker';
import { buildContextContract, validateContextContract } from './context_contract';
import { preprocessTextForLlmInput } from '../document';
import { classifyAndBudget, type SceneContextBudget, type SceneTypeResult } from './scene_type_classifier';
import { buildProjectIdentityBlock } from './project_identity_block';
import { retrieveHscContext } from '../memory/hierarchical_summary_cache';
import { retrieveForWriting } from '../memory/hybrid_memory_query';
import { renderPackSection } from '../memory/retrieval_pack_builder';
import { routeMemoryForScene, type MemoryRouteResult } from './scene_memory_router';
import { buildSceneMindState, renderSceneMindSection } from './scene_mind_builder';
import { buildSceneCard, renderSceneCardSection } from './scene_card_planner';
import { buildVoiceConstraints, renderVoiceConstraintsSection } from './voice_constraint_builder';
import { buildEraRegisterGuardrailSection } from './era_register_guardrails';

interface WritingContext {
  contextText: string;
  tokenEstimate: number;
  rawTokenEstimate: number;
  reducedTokenCount: number;
  reductionPercent: number;
  sections: string[];
  validationPass: boolean;
  warnings: string[];
  /** Scene type classification result (if available) */
  sceneType?: SceneTypeResult;
}

const CONTEXT_MAX_CHARS = 18000;

export async function buildWritingContext(
  project: Project,
  targetChapterIndex: number,
  styleRules?: StyleRule[],
): Promise<WritingContext> {
  const sections: string[] = [];

  // [Domain:ContextSelection] Scene-Type Selective Loading (MemPalace L0→L3)
  const { sceneType, budget } = classifyAndBudget(project, targetChapterIndex);

  // [Domain:ContextSelection] STEP 1.5 — Route memory based on scene type
  // Instead of always loading the same data shape, Director identifies WHAT
  // is relevant for this scene type (MemPalace hierarchical pre-filtering concept)
  const memoryRoute = routeMemoryForScene(
    sceneType,
    project.outline?.[targetChapterIndex],
    project,
    targetChapterIndex,
  );

  // L0: Project Identity Block (~200 tokens, always loaded first)
  const identityBlock = buildProjectIdentityBlock(project, targetChapterIndex, sceneType);
  sections.push(identityBlock.text);

  // Board 0.5: Long-Range Memory (HSC Tier 2+3) — only for chapter > 10
  // [Domain:ContextSelection] Injects global + arc summaries for long-range recall
  const hscBudget = budget.recentSummaryChars > 1000 ? 1500 : 800;
  const hscBlock = await retrieveHscContext(project.id, targetChapterIndex, hscBudget);
  if (hscBlock) {
    sections.push(hscBlock.text);
  }

  // L1: Task Brief (8 boards) Execution Pack — now with scene-aware budgets
  // Board 1: Core Task
  const beat = buildCurrentBeat(project.outline || [], targetChapterIndex);
  if (beat) sections.push(beat);

  // Board 2: Previous Handoff (budget-aware)
  const recentSummaries = buildRecentSummaries(project, targetChapterIndex, budget.recentSummaryChars);
  if (recentSummaries) sections.push(recentSummaries);
  const prevChapter = buildPreviousChapterTail(project, targetChapterIndex, budget.prevChapterTailChars);
  if (prevChapter) sections.push(prevChapter);

  // Board 3: Character on-stage (route-aware + budget-aware)
  // [Domain:ContextSelection] Router determines WHICH entities to deep-load
  // instead of relying solely on cluster detection
  if (memoryRoute.includeGraphCommunities) {
    const chars = await buildClusterAwareNarrativeBrief(project, targetChapterIndex, budget.characterChars);
    if (chars) {
      sections.push(chars);
    } else {
      const fallbackChars = buildCharactersBrief(project.characters || [], budget.characterChars);
      if (fallbackChars) sections.push(fallbackChars);
    }
  } else {
    // Lightweight character brief when graph communities aren't needed
    const fallbackChars = buildCharactersBrief(project.characters || [], budget.characterChars);
    if (fallbackChars) sections.push(fallbackChars);
  }

  // [Domain:ContextSelection] Route-aware hybrid retrieval — uses scene-specific
  // semantic query instead of generic beat concatenation
  const hybridNarrative = await buildRoutedHybridSection(project, targetChapterIndex, memoryRoute, budget.characterChars);
  if (hybridNarrative) sections.push(hybridNarrative);

  const sceneMindState = buildSceneMindState(project, targetChapterIndex, sceneType, memoryRoute);
  sections.push(renderSceneMindSection(sceneMindState, project));

  const sceneCard = buildSceneCard(project, targetChapterIndex, sceneType, memoryRoute, sceneMindState);
  sections.push(renderSceneCardSection(sceneCard));

  const voiceConstraints = buildVoiceConstraints(project, sceneType, sceneMindState);
  sections.push(renderVoiceConstraintsSection(voiceConstraints));

  // Board 4: Scene & Power Constraints (route-aware + budget-aware)
  const bible = buildBibleSnapshot(project, budget.bibleChars);
  if (bible) sections.push(bible);
  // [Domain:ContextSelection] Only expand world context when router says it's relevant
  if (memoryRoute.expandWorldContext) {
    const world = buildWorldBrief(project);
    if (world) sections.push(world);
  }
  sections.push(buildEraRegisterGuardrailSection(project));

  // Board 5: Time Constraints
  const timeConstraints = extractTimeConstraints([]);
  if (timeConstraints.anchors.length > 0) {
    sections.push(`## Board 5: Ràng buộc thời gian\nCác mốc thời gian cốt lõi: ${timeConstraints.anchors.map(a => a.timestamp).join(', ')}`);
  }

  // Board 6: Style Guidance
  if (styleRules && styleRules.length > 0) {
    const styleGuide = buildStyleGuideSection(styleRules);
    if (styleGuide) sections.push(styleGuide);
  }

  // Board 6.5: Genre Template Guidance
  const genre = project.genre || '';
  const tags = project.subGenre || [];
  const templateGuidance = injectTemplateToWriterPrompt(genre, tags, targetChapterIndex);
  if (templateGuidance) sections.push(`## GENRE TEMPLATE GUIDANCE\n${templateGuidance}`);

  // Board 7: Continuity & Foreshadowing (route-aware)
  if (memoryRoute.includeForeshadowing) {
    const foreshadowing = buildActiveForeshadowings(project.foreshadowings);
    if (foreshadowing) sections.push(foreshadowing);
  }

  // Board 8: Reading Power Strategy
  sections.push(`## Board 8: Chiến lược sức hút (Reading Power)
- Đảm bảo có ít nhất 1 Hook ở cuối chương.
- Tạo Micro-payoff trong hội thoại hoặc phát triển kỹ năng.`);

  const finalized = finalizeContext(sections);
  finalized.sceneType = sceneType;

  // Context Contract Validation (Red-line checks)
  const contract = buildContextContract(project, targetChapterIndex);
  const validation = validateContextContract(project, finalized.contextText, targetChapterIndex, contract);
  
  if (!validation.passed && validation.violations.length > 0) {
    finalized.warnings = [...(finalized.warnings || []), ...validation.violations];
    finalized.validationPass = false;
  }

  // Log scene type for debugging
  if (sceneType.confidence > 0.3) {
    finalized.warnings.push(
      `[L0] Scene: ${sceneType.primary}${sceneType.secondary ? `+${sceneType.secondary}` : ''} (conf: ${(sceneType.confidence * 100).toFixed(0)}%)`
    );
  }

  return finalized;
}

export async function buildTemporalWritingContext(
  project: Project,
  targetChapterIndex: number,
  styleRules?: StyleRule[],
): Promise<WritingContext> {
  const temporalProject = await buildTemporalProjectView(project, targetChapterIndex + 1);
  const warnings = await getContinuityWarnings(project.id, Math.max(1, targetChapterIndex));
  const context = await buildWritingContext(temporalProject, targetChapterIndex, styleRules);

  if (warnings.length === 0) {
    return context;
  }

  const warningSection = `## CẢNH BÁO CONTINUITY\n${warnings
    .slice(0, 5)
    .map((warning) => `- Ch.${warning.chapterIndex}: ${warning.recommendedAction}`)
    .join('\n')}`;

  return finalizeContext([warningSection, ...context.sections]);
}

export async function buildSurpriseContext(
  project: Project,
  targetChapterIndex: number,
  tensionLevel: TensionLevel,
  branch: SurpriseBranch,
  anchors: AnchorSet,
  expectation: ExpectationProfile,
  styleRules?: StyleRule[],
  sourceOverride?: string,
): Promise<WritingContext> {
  const sections: string[] = [];

  const story = buildBibleSnapshot(project);
  if (story) sections.push(story);

  const chars = await buildEntityTimelineSection(project, targetChapterIndex);
  if (chars) sections.push(chars);

  const world = buildWorldBrief(project);
  if (world) sections.push(world);
  sections.push(buildEraRegisterGuardrailSection(project));

  const recent = buildRecentSummaries(project, targetChapterIndex);
  if (recent) sections.push(recent);

  const previousTail = sourceOverride
    ? `## NGỮ CẢNH NGAY TRƯỚC KHI VIẾT\n${quickTruncate(sourceOverride, 1600)}`
    : buildPreviousChapterTail(project, targetChapterIndex);
  if (previousTail) sections.push(previousTail);

  const anchorSection = buildAnchorsSection(anchors);
  if (anchorSection) sections.push(anchorSection);

  const expectationSection = buildExpectationSection(expectation, branch);
  if (expectationSection) sections.push(expectationSection);

  const tensionSection = buildTensionSection(project, targetChapterIndex, tensionLevel, branch);
  if (tensionSection) sections.push(tensionSection);

  if (styleRules && styleRules.length > 0) {
    const styleGuide = buildStyleGuideSection(styleRules);
    if (styleGuide) sections.push(styleGuide);
  }

  // [Domain:StoryTemplate] Inject genre template guidance for writer
  const genre = project.genre || '';
  const tags = project.subGenre || [];
  const templateGuidance = injectTemplateToWriterPrompt(genre, tags, targetChapterIndex);
  if (templateGuidance) sections.push(`## GENRE TEMPLATE GUIDANCE\n${templateGuidance}`);

  const writingContract = buildOutputContract(tensionLevel);
  if (writingContract) sections.push(writingContract);

  return finalizeContext(sections);
}

function finalizeContext(sections: string[]): WritingContext {
  const contextText = sections.join('\n\n');
  const compacted = preprocessTextForLlmInput(contextText, { maxChars: CONTEXT_MAX_CHARS });

  const warnings: string[] = [];
  if (compacted.stats.reducedTokens > 0) {
    warnings.push(
      `Context compacted: ${compacted.stats.rawTokens} -> ${compacted.stats.cleanTokens} tokens`
    );
  }

  return {
    contextText: compacted.cleanText,
    tokenEstimate: compacted.stats.cleanTokens,
    rawTokenEstimate: compacted.stats.rawTokens,
    reducedTokenCount: compacted.stats.reducedTokens,
    reductionPercent: compacted.stats.reductionPercent,
    sections,
    validationPass: true,
    warnings,
  };
}

function buildBibleSnapshot(project: Project, maxChars?: number): string {
  const budget = maxChars ?? 2000;
  // [Domain:ContextSelection] Scale truncation limits based on scene budget
  const scale = Math.min(1, budget / 2000);
  const parts: string[] = ['## BỐI CẢNH TRUYỆN'];
  if (project.title) parts.push(`Tên: ${project.title}`);
  if (project.genre) parts.push(`Thể loại: ${project.genre}`);
  if (project.logline) parts.push(`Logline: ${quickTruncate(project.logline, Math.round(200 * scale))}`);
  if (project.tone) parts.push(`Giọng văn: ${project.tone}`);
  if (project.writingStyle) parts.push(`Phong cách: ${project.writingStyle}`);
  if (project.characterSetup) parts.push(`Thiết lập nhân vật: ${quickTruncate(project.characterSetup, Math.round(220 * scale))}`);
  if (project.worldSetting) parts.push(`Thiết lập thế giới: ${quickTruncate(project.worldSetting, Math.round(220 * scale))}`);
  if (project.endgame) parts.push(`Kết thúc dự kiến: ${quickTruncate(project.endgame, Math.round(200 * scale))}`);
  if (project.mainPlot) parts.push(`Cốt truyện chính: ${quickTruncate(project.mainPlot, Math.round(350 * scale))}`);
  // P3b - Input Governance: explicitly guide AI with high-level intent
  if (project.authorIntent) parts.push(`[ĐỊNH HƯỚNG DÀI HẠN]: ${quickTruncate(project.authorIntent, Math.round(200 * scale))}`);
  if (project.currentFocus) parts.push(`[TRỌNG TÂM HIỆN TẠI]: ${quickTruncate(project.currentFocus, Math.round(200 * scale))}`);
  if (project.notes) parts.push(`Ghi chú tác giả: ${quickTruncate(project.notes, Math.round(220 * scale))}`);
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildCharactersBrief(characters: Character[], maxChars?: number): string {
  if (characters.length === 0) return '';
  const budget = maxChars ?? 2000;
  // [Domain:ContextSelection] Scale character trait detail based on scene budget
  const traitLimit = Math.max(30, Math.round(80 * Math.min(1, budget / 2000)));
  const psychologyLimit = Math.max(60, Math.round(180 * Math.min(1, budget / 2000)));
  const speechLimit = Math.max(50, Math.round(120 * Math.min(1, budget / 2000)));

  const lines = characters.map((character) => {
    const parts = [`- ${character.name} (${character.role})`];
    if (character.traits) parts.push(`: ${quickTruncate(character.traits, traitLimit)}`);
    if (character.currentStage) parts.push(` [${character.currentStage}]`);
    const psychologySummary = buildPsychologySummary(character, psychologyLimit);
    if (psychologySummary) parts.push(` | ${psychologySummary}`);
    if (character.aliases?.length) parts.push(` aka ${character.aliases.join(', ')}`);
    const speechSummary = buildSpeechProfileSummary(character, speechLimit);
    if (speechSummary) parts.push(` | ${speechSummary}`);
    return parts.join('');
  });

  return `## NHÂN VẬT\n${lines.join('\n')}`;
}

function buildPsychologySummary(character: Character, maxChars = 180): string {
  const psychology = character.psychology;
  if (!psychology) return '';

  const parts: string[] = [];
  if (psychology.coreWound) parts.push(`vết thương ${psychology.coreWound}`);
  if (psychology.deepFear) parts.push(`sợ ${psychology.deepFear}`);
  if (psychology.hiddenDesire) parts.push(`muốn thật ${psychology.hiddenDesire}`);
  if (psychology.selfDeception) parts.push(`tự lừa ${psychology.selfDeception}`);
  if (psychology.bodyLanguage) parts.push(`stress ${psychology.bodyLanguage}`);
  if (parts.length === 0) return '';
  return quickTruncate(`TÂM LÝ: ${parts.join(' | ')}`, maxChars);
}

function buildSpeechProfileSummary(character: Character, maxChars = 120): string {
  const profile = character.speechProfile;
  if (!profile) return '';

  const parts: string[] = [];
  if (profile.defaultSelfPronouns.length > 0) {
    parts.push(`xưng ${profile.defaultSelfPronouns.join('/')}`);
  }
  if (profile.defaultAddressPronouns.length > 0) {
    parts.push(`gọi người khác ${profile.defaultAddressPronouns.join('/')}`);
  }
  if (profile.forbiddenPronouns?.length) {
    parts.push(`tránh ${profile.forbiddenPronouns.join('/')}`);
  }
  if (profile.situationalRules?.length) {
    const topRule = profile.situationalRules[0];
    const ruleTarget = topRule.targetCharacterName ? ` với ${topRule.targetCharacterName}` : '';
    const rulePairs = topRule.preferredPairs?.join(', ') || [
      ...(topRule.selfPronouns || []),
      ...(topRule.addressPronouns || []),
    ].join(' / ');
    if (rulePairs) {
      parts.push(`${topRule.situation}${ruleTarget}: ${rulePairs}`);
    }
  }
  if (profile.toneNotes) {
    parts.push(profile.toneNotes);
  }

  return quickTruncate(parts.filter(Boolean).join('; '), maxChars);
}

async function buildClusterAwareNarrativeBrief(
  project: Project,
  targetChapterIndex: number,
  maxChars?: number
): Promise<string> {
  const budget = maxChars ?? 2000;
  const narrativeState = await getClusterAwareNarrativeState(project, targetChapterIndex);
  if (narrativeState.communities.length === 0) return '';

  const lines: string[] = ['## CỤM NARRATIVE LIÊN QUAN'];
  const nodeCharLimit = Math.max(80, Math.round(budget / 5));

  narrativeState.communities.forEach((entry, index) => {
    const nodeSummary = entry.nodes
      .map((node) => `${node.label} (${node.nodeType})`)
      .join(' | ');
    lines.push(`${index + 1}. ${entry.community.label}`);
    if (nodeSummary) {
      lines.push(`- Trọng tâm: ${quickTruncate(nodeSummary, nodeCharLimit)}`);
    }
  });

  if (narrativeState.openForeshadowings.length > 0) {
    const foreshadowingSummary = narrativeState.openForeshadowings
      .slice(0, 2)
      .map((item) => quickTruncate(item.description, 70))
      .join(' | ');
    lines.push(`- Open threads: ${foreshadowingSummary}`);
  }

  if (narrativeState.continuityWarnings.length > 0) {
    const warningSummary = narrativeState.continuityWarnings
      .slice(0, 2)
      .map((item) => `Ch.${item.chapterIndex}: ${quickTruncate(item.recommendedAction, 70)}`)
      .join(' | ');
    lines.push(`- Continuity risks: ${warningSummary}`);
  }

  return lines.join('\n');
}

function buildWritingRetrievalQuery(project: Project, targetChapterIndex: number): string {
  const beat = project.outline?.[targetChapterIndex];
  const previousChapter = (project.chapters || []).find((chapter) => (chapter.sequenceNumber ?? 0) === targetChapterIndex);
  return [
    beat?.title || '',
    beat?.focus || '',
    beat?.summary || '',
    previousChapter?.summary || '',
    project.mainPlot || '',
  ]
    .filter(Boolean)
    .join(' | ');
}

async function buildHybridRetrievalSection(
  project: Project,
  targetChapterIndex: number,
  maxChars?: number
): Promise<string> {
  const query = buildWritingRetrievalQuery(project, targetChapterIndex);
  if (!query.trim()) return '';

  const result = await retrieveForWriting(project, targetChapterIndex, query).catch(() => null);
  if (!result) return '';

  const budget = maxChars ?? 2000;
  const lines: string[] = [];

  const canonSection = renderPackSection('## CANON ƯU TIÊN', result.canonPack, { limit: 4 });
  if (canonSection) lines.push(canonSection);

  const stateSection = renderPackSection('## SNAPSHOT TRẠNG THÁI', result.statePack, { limit: 4 });
  if (stateSection) lines.push(stateSection);

  const hookSection = renderPackSection('## HOOK CHƯA THANH TOÁN', result.hookPack, { limit: 4 });
  if (hookSection) lines.push(hookSection);

  const graphSection = renderPackSection('## ĐIỂM NEO ĐỒ THỊ', result.graphPack, {
    limit: 4,
    includeTitles: true,
  });
  if (graphSection) lines.push(graphSection);

  const semanticSection = renderPackSection('## TRÍCH ĐOẠN NGỮ NGHĨA LIÊN QUAN', result.semanticPack, {
    limit: 3,
    bodyMaxChars: Math.max(120, Math.round(budget / 2)),
  });
  if (semanticSection) lines.push(semanticSection);

  const riskSection = renderPackSection('## RỦI RO CONTINUITY', result.riskPack, {
    limit: 2,
    bodyMaxChars: 220,
    includeTitles: true,
  });
  if (riskSection) lines.push(riskSection);

  return lines.join('\n');
}

/**
 * [Domain:ContextSelection] Route-aware hybrid retrieval.
 * Uses scene_memory_router's targeted semantic query + boost keywords
 * instead of generic beat concatenation. This is the key integration point
 * where scene classification influences WHAT data gets retrieved.
 */
async function buildRoutedHybridSection(
  project: Project,
  targetChapterIndex: number,
  route: MemoryRouteResult,
  maxChars?: number
): Promise<string> {
  const query = route.semanticQuery;
  if (!query.trim()) return '';

  const result = await retrieveForWriting(project, targetChapterIndex, query).catch(() => null);
  if (!result) return '';

  const budget = maxChars ?? 2000;
  const lines: string[] = [];

  const canonSection = renderPackSection('## CANON ƯU TIÊN', result.canonPack, { limit: 4 });
  if (canonSection) lines.push(canonSection);

  const stateSection = renderPackSection('## SNAPSHOT TRẠNG THÁI', result.statePack, { limit: 4 });
  if (stateSection) lines.push(stateSection);

  const hookSection = renderPackSection('## HOOK CHƯA THANH TOÁN', result.hookPack, { limit: 4 });
  if (hookSection) lines.push(hookSection);

  // [Domain:ContextSelection] Only include graph context when router enables it
  if (route.includeGraphCommunities) {
    const graphSection = renderPackSection('## ĐIỂM NEO ĐỒ THỊ', result.graphPack, {
      limit: 4,
      includeTitles: true,
    });
    if (graphSection) lines.push(graphSection);
  }

  const semanticSection = renderPackSection('## TRÍCH ĐOẠN NGỮ NGHĨA LIÊN QUAN', result.semanticPack, {
    limit: 3,
    bodyMaxChars: Math.max(120, Math.round(budget / 2)),
  });
  if (semanticSection) lines.push(semanticSection);

  if (result.riskPack.length > 0) {
    const riskSection = renderPackSection('## RỦI RO CONTINUITY', result.riskPack, {
      limit: route.includeForeshadowing ? 2 : 1,
      bodyMaxChars: 220,
      includeTitles: true,
    });
    if (riskSection) lines.push(riskSection);
  }

  // [Domain:ContextSelection] Append routing reasoning as debug trace
  if (route.reasoning) {
    lines.push(`<!-- Route: ${route.reasoning} -->`);
  }

  return lines.join('\n');
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function selectRelevantCharacters(project: Project, targetChapterIndex: number, limit = 4): Character[] {
  const characters = project.characters || [];
  if (characters.length <= limit) return characters;

  const currentBeat = project.outline?.[targetChapterIndex];
  const focusText = normalizeLookup(`${currentBeat?.focus || ''} ${currentBeat?.summary || ''}`);

  const matched = characters.filter((character) => {
    const names = [character.name, ...(character.aliases || [])]
      .map(normalizeLookup)
      .filter(Boolean);
    return names.some((name) => focusText.includes(name));
  });

  if (matched.length > 0) return matched.slice(0, limit);
  return characters.slice(0, limit);
}

function buildSnapshotMilestones(snapshots: EntitySnapshot[], upToChapter: number): string[] {
  const relevant = snapshots
    .filter((snapshot) => snapshot.chapterIndex > 0 && snapshot.chapterIndex <= upToChapter)
    .sort((left, right) => left.chapterIndex - right.chapterIndex);

  if (relevant.length === 0) return [];

  const milestones: string[] = [];
  let previousAttributes: Record<string, string> | null = null;

  for (const snapshot of relevant) {
    const changedEntries = Object.entries(snapshot.attributes).filter(([key, value]) => {
      if (!value || key === 'name' || key === 'role' || key === 'traits') return false;
      return previousAttributes ? previousAttributes[key] !== value : false;
    });

    if (changedEntries.length > 0) {
      const topChanges = changedEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${quickTruncate(value, 40)}`)
        .join(', ');
      milestones.push(`Ch.${snapshot.chapterIndex}: ${topChanges}`);
    }

    previousAttributes = snapshot.attributes;
  }

  return milestones.slice(-3);
}

async function buildEntityTimelineSection(project: Project, targetChapterIndex: number): Promise<string> {
  const relevantCharacters = selectRelevantCharacters(project, targetChapterIndex);
  if (relevantCharacters.length === 0) return '';

  const chapterNumber = Math.max(0, targetChapterIndex);
  const lines = await Promise.all(
    relevantCharacters.map(async (character) => {
      const snapshots = await getEntityTimelineSnapshots(project.id, character.id).catch(() => []);
      if (snapshots.length === 0) {
        const parts = [`- ${character.name} (${character.role || 'chưa rõ vai trò'})`];
        if (character.currentStage) parts.push(` [${quickTruncate(character.currentStage, 40)}]`);
        if (character.traits) parts.push(`: ${quickTruncate(character.traits, 80)}`);
        const psychologySummary = buildPsychologySummary(character, 180);
        if (psychologySummary) parts.push(` | ${psychologySummary}`);
        const speechSummary = buildSpeechProfileSummary(character, 120);
        if (speechSummary) parts.push(` | ${speechSummary}`);
        return parts.join('');
      }

      const visibleSnapshots = snapshots
        .filter((snapshot) => snapshot.chapterIndex > 0 && snapshot.chapterIndex <= chapterNumber)
        .sort((left, right) => left.chapterIndex - right.chapterIndex);
      const currentSnapshot = visibleSnapshots[visibleSnapshots.length - 1];
      const currentStage = currentSnapshot?.attributes.current_stage || character.currentStage;
      const role = currentSnapshot?.attributes.role || character.role;
      const traits = currentSnapshot?.attributes.traits || character.traits;
      const psychology = {
        coreWound: currentSnapshot?.attributes.core_wound || character.psychology?.coreWound || '',
        deepFear: currentSnapshot?.attributes.deep_fear || character.psychology?.deepFear || '',
        hiddenDesire: currentSnapshot?.attributes.hidden_desire || character.psychology?.hiddenDesire || '',
        selfDeception: currentSnapshot?.attributes.self_deception || character.psychology?.selfDeception || '',
        bodyLanguage: currentSnapshot?.attributes.body_language || character.psychology?.bodyLanguage || '',
      };
      const milestones = buildSnapshotMilestones(snapshots, chapterNumber);
      const speechSummary = buildSpeechProfileSummary(character, 120);

      const parts = [`- ${character.name} (${role || 'chưa rõ vai trò'})`];
      if (currentStage) parts.push(` [${quickTruncate(currentStage, 40)}]`);
      if (traits) parts.push(`: ${quickTruncate(traits, 80)}`);
      const psychologySummary = buildPsychologySummary({ ...character, psychology }, 180);
      if (psychologySummary) parts.push(` | ${psychologySummary}`);
      if (speechSummary) parts.push(` | ${speechSummary}`);
      if (milestones.length > 0) parts.push(` | Mốc: ${milestones.join(' | ')}`);
      return parts.join('');
    })
  );

  return `## TIMELINE NHÂN VẬT TRỌNG TÂM\n${lines.join('\n')}`;
}

function buildWorldBrief(project: Project): string {
  const world = project.world;
  const parts: string[] = ['## THẾ GIỚI QUAN'];
  if (world.geography) parts.push(`Bối cảnh: ${quickTruncate(world.geography, 150)}`);
  if (world.magicSystem) parts.push(`Hệ thống: ${quickTruncate(world.magicSystem, 150)}`);
  if (world.techLevel) parts.push(`Mức công nghệ: ${quickTruncate(world.techLevel, 100)}`);
  if (world.currency) parts.push(`Tiền tệ: ${quickTruncate(world.currency, 80)}`);
  if (world.rules) parts.push(`Luật: ${quickTruncate(world.rules, 150)}`);
  if (world.factions?.length) parts.push(`Phe phái: ${world.factions.join(', ')}`);
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildRecentSummaries(project: Project, targetIndex: number, maxChars?: number): string {
  const chapters = getChaptersChronological(project);
  if (chapters.length === 0) return '';

  const budget = maxChars ?? 1200;
  // [Domain:ContextSelection] Scene type determines how many recent chapters to show
  const windowSize = budget >= 1200 ? 5 : budget >= 800 ? 3 : 2;
  const summaryTruncate = Math.max(80, Math.round(200 * Math.min(1, budget / 1200)));

  const endIndex = Math.min(targetIndex, chapters.length);
  const startIndex = Math.max(0, endIndex - windowSize);
  const recent = chapters.slice(startIndex, endIndex);
  if (recent.length === 0) return '';

  const lines = recent.map((chapter, index) => {
    const logicalIndex = startIndex + index + 1;
    const summary = chapter.summary || quickTruncate(chapter.content, 150);
    return `Ch.${logicalIndex} "${chapter.title}": ${quickTruncate(summary, summaryTruncate)}`;
  });

  return `## CÁC CHƯƠNG GẦN ĐÂY\n${lines.join('\n')}`;
}

function buildPreviousChapterTail(project: Project, targetIndex: number, maxChars?: number): string {
  const chapters = getChaptersChronological(project);
  const prevIndex = targetIndex - 1;
  if (prevIndex < 0 || prevIndex >= chapters.length) return '';

  // [Domain:ContextSelection] Scene type controls how much previous chapter tail to load
  const tailBudget = maxChars ?? 1500;
  const previous = chapters[prevIndex];
  const tail = previous.content.length > tailBudget
    ? `…${previous.content.substring(previous.content.length - tailBudget)}`
    : previous.content;

  return `## ĐOẠN CUỐI CHƯƠNG TRƯỚC (Ch.${prevIndex + 1})\n${tail}`;
}

function buildActiveForeshadowings(foreshadowings: Foreshadowing[] = []): string {
  const active = foreshadowings.filter((item) => !item.isResolved);
  if (active.length === 0) return '';
  const lines = active.map((item) => `- ${quickTruncate(item.description, 100)}`);
  return `## MẦM MỐI CHƯA GIẢI QUYẾT\n${lines.join('\n')}`;
}

function buildCurrentBeat(outline: OutlineBeat[], targetIndex: number): string {
  if (outline.length === 0 || targetIndex >= outline.length) return '';
  const beat = outline[targetIndex];
  if (!beat) return '';
  
  const parts = [
    `## NHỊP TRUYỆN HIỆN TẠI (Beat ${targetIndex + 1})`,
    `Tiêu đề: ${beat.title}`,
    `Nội dung: ${quickTruncate(beat.summary, 300)}`,
    `Trọng tâm: ${beat.focus}`
  ];
  
  // P2a: Inject Blueprint metadata to guide AI generation style
  if (beat.chapterRole) parts.push(`Vai trò chương: ${beat.chapterRole}`);
  if (beat.suspenseLevel) parts.push(`Mức độ kịch tính (1-5): ${beat.suspenseLevel}`);
  if (beat.plotTwistLevel) parts.push(`Mức độ bất ngờ (1-5): ${beat.plotTwistLevel}`);
  if (beat.foreshadowingHint) parts.push(`Gợi ý phục bút: ${beat.foreshadowingHint}`);

  return parts.join('\n');
}

function buildTargetBeat(outline: OutlineBeat[], targetIndex: number): string {
  if (outline.length === 0) return '';
  const safeIndex = Math.min(targetIndex + 3, outline.length - 1);
  const beat = outline[safeIndex];
  if (!beat) return '';
  return `## ĐÍCH XA HƠN CẦN HƯỚNG TỚI (Beat ${safeIndex + 1})\nTiêu đề: ${beat.title}\nNội dung: ${quickTruncate(beat.summary, 300)}\nTrọng tâm: ${beat.focus}`;
}

function buildAnchorsSection(anchors: AnchorSet): string {
  if (anchors.all.length === 0) return '';
  const sections: string[] = ['## HARD ANCHORS KHÔNG ĐƯỢC PHÁ'];
  const groups: Array<[string, typeof anchors.endgame]> = [
    ['Endgame', anchors.endgame],
    ['Character truth', anchors.characterTruth],
    ['Established fact', anchors.establishedFact],
    ['Foreshadowing planted', anchors.foreshadowingPlanted],
  ];

  groups.forEach(([label, list]) => {
    if (list.length === 0) return;
    sections.push(`${label}:`);
    list.slice(0, 6).forEach((anchor) => {
      sections.push(`- [${anchor.id}] ${quickTruncate(anchor.detail, 140)}`);
    });
  });

  return sections.join('\n');
}

function buildExpectationSection(expectation: ExpectationProfile, branch: SurpriseBranch): string {
  const parts = ['## KỲ VỌNG ĐỘC GIẢ VÀ NHÁNH ĐÃ CHỌN'];
  parts.push(`Kỳ vọng trội nhất: ${quickTruncate(expectation.dominantExpectation, 180)}`);
  if (expectation.alternativeExpectations.length > 0) {
    parts.push(`Kỳ vọng phụ: ${expectation.alternativeExpectations.map((item) => quickTruncate(item, 80)).join(' | ')}`);
  }
  if (expectation.setupSignals.length > 0) {
    parts.push(`Tín hiệu dẫn dắt: ${expectation.setupSignals.map((item) => quickTruncate(item, 80)).join(' | ')}`);
  }
  parts.push(`Nhánh đã chọn: ${branch.suggestedTitle}`);
  parts.push(`Surprise vector: ${branch.surpriseVector}`);
  parts.push(`Tóm tắt nhánh: ${branch.summary}`);
  parts.push(`Beat strategy: ${branch.beatStrategy}`);
  parts.push(`Anchors cần giữ: ${branch.preservedAnchorIds.join(', ') || 'Không có'}`);
  if (branch.foreshadowNow.length > 0) {
    parts.push(`Clue phải gieo ngay: ${branch.foreshadowNow.join(' | ')}`);
  }
  if (branch.impactTrace.length > 0) {
    parts.push(`Hệ quả downstream: ${branch.impactTrace.join(' | ')}`);
  }
  return parts.join('\n');
}

function buildTensionSection(
  project: Project,
  targetChapterIndex: number,
  tensionLevel: TensionLevel,
  branch: SurpriseBranch,
): string {
  const parts = [`## CHỈ THỊ TENSION: ${tensionLevel.toUpperCase()}`];

  if (tensionLevel === 'follow' || tensionLevel === 'nudge') {
    const beat = buildCurrentBeat(project.outline, targetChapterIndex);
    if (beat) parts.push(beat);
  }

  if (tensionLevel === 'twist') {
    const targetBeat = buildTargetBeat(project.outline, targetChapterIndex);
    if (targetBeat) parts.push(targetBeat);
    parts.push('Không cần hoàn thành beat hiện tại nếu nhánh này mở ra đường mạnh hơn tới đích xa hơn.');
  }

  if (tensionLevel === 'subvert') {
    parts.push('Đảo kỳ vọng đang được setup rõ nhất, nhưng tuyệt đối không phá hard anchors.');
    parts.push('Bắt buộc gieo ít nhất một clue để khi đọc lại, twist có logic.');
  }

  parts.push(`Bẻ lái kỳ vọng theo hướng: ${branch.challengedExpectation || 'giữ nhịp nhưng tránh đi đường quá thẳng'}`);
  return parts.join('\n\n');
}

function buildOutputContract(tensionLevel: TensionLevel): string {
  const rules = [
    '## HỢP ĐỒNG ĐẦU RA',
    'Viết văn xuôi tiếng Việt tự nhiên, không markdown, không bullet, không meta commentary.',
    'Bảo toàn hard anchors đã nêu.',
    'Chỉ introduce entity mới khi thật cần thiết; nếu có, phải nêu rõ vai trò của entity đó.',
    'Kết thúc chương ở điểm đủ kéo chương sau.',
    'Cuối cùng PHẢI trả đúng format:',
    '@@LEDGER@@',
    '{"summary":"...","beatStatus":"hit|delay|replace","usedCharacterNames":["..."],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":["..."]}',
    '@@CONTENT@@',
    '[chapter prose only]',
  ];

  if (tensionLevel === 'subvert') {
    rules.splice(4, 0, 'Vì đây là subvert, ledger.foreshadowPlanted không được để rỗng.');
  }

  return rules.join('\n');
}
