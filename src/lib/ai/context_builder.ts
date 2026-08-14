/**
 * File: context_builder.ts
 * Purpose: Xây dựng context tối ưu cho AI viết chương và surprise engine.
 *          Tích hợp Scene-Type Selective Loading (MemPalace L0→L3 concept)
 *          và Project Identity Block (~200 tokens wake-up).
 */
import type { Project, Character, OutlineBeat, Foreshadowing } from '../../types/story';
import { buildForeshadowReminderSection } from './foreshadow_tracker';
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
import { injectWriterSafeTemplateGuidance } from './writer_template_policy';
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
import { classifyAndBudget, type SceneTypeResult } from './scene_type_classifier';
import { buildProjectIdentityBlock } from './project_identity_block';
import { retrieveHscContext } from '../memory/hierarchical_summary_cache';
import { retrieveForWriting } from '../memory/hybrid_memory_query';
import { compileStoryContext, renderCompiledStoryContext } from '../memory/context_compiler';
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
  sceneType?: SceneTypeResult;
}

function getContextMaxChars(project: Project): number {
  const count = project.chapters?.length ?? 0;
  if (count <= 20) return 18000;
  if (count <= 50) return 22000;
  if (count <= 100) return 25000;
  return 28000;
}

export async function buildWritingContext(
  project: Project,
  targetChapterIndex: number,
  styleRules?: StyleRule[],
): Promise<WritingContext> {
  const sections: string[] = [];

  const { sceneType, budget } = classifyAndBudget(project, targetChapterIndex);
  const memoryRoute = routeMemoryForScene(
    sceneType,
    project.outline?.[targetChapterIndex],
    project,
    targetChapterIndex,
  );

  const identityBlock = buildProjectIdentityBlock(project, targetChapterIndex, sceneType);
  sections.push(identityBlock.text);

  const chapterCount = project.chapters?.length ?? 0;
  const hscBudget = chapterCount > 20
    ? (budget.recentSummaryChars > 1000 ? 2500 : 1500)
    : (budget.recentSummaryChars > 1000 ? 1500 : 800);
  const hscBlock = await retrieveHscContext(project.id, targetChapterIndex, hscBudget);
  if (hscBlock) sections.push(hscBlock.text);

  const beat = buildCurrentBeat(project.outline || [], targetChapterIndex);
  if (beat) sections.push(beat);

  const recentSummaries = buildRecentSummaries(project, targetChapterIndex, budget.recentSummaryChars);
  if (recentSummaries) sections.push(recentSummaries);
  const prevChapter = buildPreviousChapterTail(project, targetChapterIndex, budget.prevChapterTailChars);
  if (prevChapter) sections.push(prevChapter);

  if (memoryRoute.includeGraphCommunities) {
    const chars = await buildClusterAwareNarrativeBrief(project, targetChapterIndex, budget.characterChars);
    if (chars) sections.push(chars);
    else {
      const fallbackChars = buildCharactersBrief(project.characters || [], budget.characterChars);
      if (fallbackChars) sections.push(fallbackChars);
    }
  } else {
    const fallbackChars = buildCharactersBrief(project.characters || [], budget.characterChars);
    if (fallbackChars) sections.push(fallbackChars);
  }

  // Retrieval evidence must pass through the policy compiler before Writer sees it.
  const hybridNarrative = await buildRoutedHybridSection(project, targetChapterIndex, memoryRoute, budget.characterChars);
  if (hybridNarrative) sections.push(hybridNarrative);

  const sceneMindState = buildSceneMindState(project, targetChapterIndex, sceneType, memoryRoute);
  sections.push(renderSceneMindSection(sceneMindState, project));
  const sceneCard = buildSceneCard(project, targetChapterIndex, sceneType, memoryRoute, sceneMindState);
  sections.push(renderSceneCardSection(sceneCard));
  const voiceConstraints = buildVoiceConstraints(project, sceneType, sceneMindState);
  sections.push(renderVoiceConstraintsSection(voiceConstraints));

  const bible = buildBibleSnapshot(project, budget.bibleChars);
  if (bible) sections.push(bible);
  if (memoryRoute.expandWorldContext) {
    const world = buildWorldBrief(project);
    if (world) sections.push(world);
  }
  sections.push(buildEraRegisterGuardrailSection(project));

  const timeConstraints = extractTimeConstraints([]);
  if (timeConstraints.anchors.length > 0) {
    sections.push(`## Board 5: Ràng buộc thời gian\nCác mốc thời gian cốt lõi: ${timeConstraints.anchors.map(a => a.timestamp).join(', ')}`);
  }

  if (styleRules && styleRules.length > 0) {
    const styleGuide = buildStyleGuideSection(styleRules);
    if (styleGuide) sections.push(styleGuide);
  }

  const genre = project.genre || '';
  const tags = project.subGenre || [];
  const templateGuidance = injectWriterSafeTemplateGuidance(genre, tags, targetChapterIndex);
  if (templateGuidance) sections.push(`## GENRE TEMPLATE GUIDANCE\n${templateGuidance}`);

  if (memoryRoute.includeForeshadowing) {
    const foreshadowing = buildActiveForeshadowings(project.foreshadowings);
    if (foreshadowing) sections.push(foreshadowing);
  }
  const foreshadowReminder = buildForeshadowReminderSection(project, targetChapterIndex);
  if (foreshadowReminder) sections.push(foreshadowReminder);

  sections.push(`## Board 8: Mục tiêu cảnh/chương
- Mỗi cảnh phải tạo thay đổi có ý nghĩa: quyết định, quan hệ, thông tin, nguy cơ hoặc trạng thái.
- Hook/payoff chỉ xuất hiện khi tự nhiên từ diễn biến; không nhét checklist để chứng minh tuân thủ rule.`);

  const finalized = finalizeContext(sections, getContextMaxChars(project));
  finalized.sceneType = sceneType;

  const contract = buildContextContract(project, targetChapterIndex);
  const validation = validateContextContract(project, finalized.contextText, targetChapterIndex, contract);
  if (!validation.passed && validation.violations.length > 0) {
    finalized.warnings = [...(finalized.warnings || []), ...validation.violations];
    finalized.validationPass = false;
  }
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
  if (warnings.length === 0) return context;
  const warningSection = `## CẢNH BÁO CONTINUITY\n${warnings
    .slice(0, 5)
    .map((warning) => `- Ch.${warning.chapterIndex}: ${warning.recommendedAction}`)
    .join('\n')}`;
  const temporal = finalizeContext([warningSection, ...context.sections], getContextMaxChars(temporalProject));
  temporal.validationPass = context.validationPass;
  temporal.sceneType = context.sceneType;
  temporal.warnings = Array.from(new Set([
    ...context.warnings,
    ...temporal.warnings,
    ...warnings.slice(0, 5).map((warning) => `Continuity Ch.${warning.chapterIndex}: ${warning.recommendedAction}`),
  ]));
  return temporal;
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
  const genre = project.genre || '';
  const tags = project.subGenre || [];
  const templateGuidance = injectWriterSafeTemplateGuidance(genre, tags, targetChapterIndex);
  if (templateGuidance) sections.push(`## GENRE TEMPLATE GUIDANCE\n${templateGuidance}`);
  const writingContract = buildOutputContract(tensionLevel);
  if (writingContract) sections.push(writingContract);
  return finalizeContext(sections, getContextMaxChars(project));
}

function finalizeContext(sections: string[], maxChars = 18000): WritingContext {
  const contextText = sections.join('\n\n');
  const compacted = preprocessTextForLlmInput(contextText, { maxChars });
  const warnings: string[] = [];
  if (compacted.stats.reducedTokens > 0) {
    warnings.push(`Context compacted: ${compacted.stats.rawTokens} -> ${compacted.stats.cleanTokens} tokens`);
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
  if (project.authorIntent) parts.push(`[ĐỊNH HƯỚNG DÀI HẠN]: ${quickTruncate(project.authorIntent, Math.round(200 * scale))}`);
  if (project.currentFocus) parts.push(`[TRỌNG TÂM HIỆN TẠI]: ${quickTruncate(project.currentFocus, Math.round(200 * scale))}`);
  if (project.notes) parts.push(`Ghi chú tác giả: ${quickTruncate(project.notes, Math.round(220 * scale))}`);
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildCharactersBrief(characters: Character[], maxChars?: number): string {
  if (characters.length === 0) return '';
  const budget = maxChars ?? 2000;
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
  return parts.length === 0 ? '' : quickTruncate(`TÂM LÝ: ${parts.join(' | ')}`, maxChars);
}

function buildSpeechProfileSummary(character: Character, maxChars = 120): string {
  const profile = character.speechProfile;
  if (!profile) return '';
  const parts: string[] = [];
  if (profile.defaultSelfPronouns.length > 0) parts.push(`xưng ${profile.defaultSelfPronouns.join('/')}`);
  if (profile.defaultAddressPronouns.length > 0) parts.push(`gọi người khác ${profile.defaultAddressPronouns.join('/')}`);
  if (profile.forbiddenPronouns?.length) parts.push(`tránh ${profile.forbiddenPronouns.join('/')}`);
  if (profile.situationalRules?.length) {
    const topRule = profile.situationalRules[0];
    const ruleTarget = topRule.targetCharacterName ? ` với ${topRule.targetCharacterName}` : '';
    const rulePairs = topRule.preferredPairs?.join(', ') || [...(topRule.selfPronouns || []), ...(topRule.addressPronouns || [])].join(' / ');
    if (rulePairs) parts.push(`${topRule.situation}${ruleTarget}: ${rulePairs}`);
  }
  if (profile.toneNotes) parts.push(profile.toneNotes);
  return quickTruncate(parts.filter(Boolean).join('; '), maxChars);
}

async function buildClusterAwareNarrativeBrief(project: Project, targetChapterIndex: number, maxChars?: number): Promise<string> {
  const budget = maxChars ?? 2000;
  const narrativeState = await getClusterAwareNarrativeState(project, targetChapterIndex);
  if (narrativeState.communities.length === 0) return '';
  const lines: string[] = ['## CỤM NARRATIVE LIÊN QUAN'];
  const nodeCharLimit = Math.max(80, Math.round(budget / 5));
  narrativeState.communities.forEach((entry, index) => {
    const nodeSummary = entry.nodes.map((node) => `${node.label} (${node.nodeType})`).join(' | ');
    lines.push(`${index + 1}. ${entry.community.label}`);
    if (nodeSummary) lines.push(`- Trọng tâm: ${quickTruncate(nodeSummary, nodeCharLimit)}`);
  });
  if (narrativeState.openForeshadowings.length > 0) {
    const summary = narrativeState.openForeshadowings.slice(0, 2).map((item) => quickTruncate(item.description, 70)).join(' | ');
    lines.push(`- Open threads: ${summary}`);
  }
  if (narrativeState.continuityWarnings.length > 0) {
    const summary = narrativeState.continuityWarnings.slice(0, 2).map((item) => `Ch.${item.chapterIndex}: ${quickTruncate(item.recommendedAction, 70)}`).join(' | ');
    lines.push(`- Continuity risks: ${summary}`);
  }
  return lines.join('\n');
}

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
  const compiled = compileStoryContext(result, {
    maxMustKnow: 8,
    maxMayUse: route.includeGraphCommunities ? 6 : 4,
    maxDoNotForce: 4,
    maxForbidden: route.includeForeshadowing ? 5 : 3,
  });
  const rendered = renderCompiledStoryContext(compiled);
  return quickTruncate(rendered, Math.max(1400, budget * 2));
}

function normalizeLookup(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function selectRelevantCharacters(project: Project, targetChapterIndex: number, limit = 4): Character[] {
  const characters = project.characters || [];
  if (characters.length <= limit) return characters;
  const currentBeat = project.outline?.[targetChapterIndex];
  const focusText = normalizeLookup(`${currentBeat?.focus || ''} ${currentBeat?.summary || ''}`);
  const matched = characters.filter((character) => {
    const names = [character.name, ...(character.aliases || [])].map(normalizeLookup).filter(Boolean);
    return names.some((name) => focusText.includes(name));
  });
  if (matched.length > 0) return matched.slice(0, limit);
  return characters.slice(0, limit);
}

function buildSnapshotMilestones(snapshots: EntitySnapshot[], upToChapter: number): string[] {
  const relevant = snapshots.filter((snapshot) => snapshot.chapterIndex > 0 && snapshot.chapterIndex <= upToChapter).sort((a,b) => a.chapterIndex-b.chapterIndex);
  if (relevant.length === 0) return [];
  const milestones: string[] = [];
  let previousAttributes: Record<string, string> | null = null;
  for (const snapshot of relevant) {
    const changedEntries = Object.entries(snapshot.attributes).filter(([key, value]) => value && key !== 'name' && key !== 'role' && key !== 'traits' && (previousAttributes ? previousAttributes[key] !== value : false));
    if (changedEntries.length > 0) {
      milestones.push(`Ch.${snapshot.chapterIndex}: ${changedEntries.slice(0,2).map(([key,value]) => `${key}=${quickTruncate(value,40)}`).join(', ')}`);
    }
    previousAttributes = snapshot.attributes;
  }
  return milestones.slice(-3);
}

async function buildEntityTimelineSection(project: Project, targetChapterIndex: number): Promise<string> {
  const relevantCharacters = selectRelevantCharacters(project, targetChapterIndex);
  if (relevantCharacters.length === 0) return '';
  const chapterNumber = Math.max(0, targetChapterIndex);
  const lines = await Promise.all(relevantCharacters.map(async (character) => {
    const snapshots = await getEntityTimelineSnapshots(project.id, character.id).catch(() => []);
    if (snapshots.length === 0) return `- ${character.name} (${character.role || 'chưa rõ vai trò'})${character.currentStage ? ` [${quickTruncate(character.currentStage,40)}]` : ''}`;
    const visible = snapshots.filter((s) => s.chapterIndex > 0 && s.chapterIndex <= chapterNumber).sort((a,b)=>a.chapterIndex-b.chapterIndex);
    const current = visible[visible.length-1];
    const milestones = buildSnapshotMilestones(snapshots, chapterNumber);
    return `- ${character.name} (${current?.attributes.role || character.role || 'chưa rõ vai trò'})${current?.attributes.current_stage || character.currentStage ? ` [${quickTruncate(current?.attributes.current_stage || character.currentStage || '',40)}]` : ''}${milestones.length ? ` | ${milestones.join(' ; ')}` : ''}`;
  }));
  return `## DÒNG THỜI GIAN NHÂN VẬT\n${lines.join('\n')}`;
}

function buildRecentSummaries(project: Project, targetChapterIndex: number, maxChars = 1800): string {
  const chronological = getChaptersChronological(project);
  const end = Math.min(Math.max(0, targetChapterIndex), chronological.length);
  const start = Math.max(0, end - 3);
  const chapters = chronological.slice(start, end);
  if (chapters.length === 0) return '';
  const each = Math.max(180, Math.floor(maxChars / chapters.length));
  return `## TÓM TẮT GẦN NHẤT\n${chapters.map((chapter, offset) => {
    const chapterNumber = chapter.sequenceNumber ?? (start + offset + 1);
    return `- Ch.${chapterNumber}: ${quickTruncate(chapter.summary || chapter.content || '', each)}`;
  }).join('\n')}`;
}

function buildPreviousChapterTail(project: Project, targetChapterIndex: number, maxChars = 1200): string {
  const chronological = getChaptersChronological(project);
  const end = Math.min(Math.max(0, targetChapterIndex), chronological.length);
  const previous = chronological.slice(0, end).slice(-1)[0];
  if (!previous?.content) return '';
  const tail = previous.content.slice(-maxChars);
  return `## ĐOẠN CUỐI CHƯƠNG TRƯỚC\n${tail}`;
}

function buildCurrentBeat(outline: OutlineBeat[], targetChapterIndex: number): string {
  const beat = outline[targetChapterIndex];
  if (!beat) return '';
  return `## NHIỆM VỤ CHƯƠNG\n${beat.focus || ''}\n${beat.summary || ''}`.trim();
}

function buildWorldBrief(project: Project): string {
  return project.worldSetting ? `## THẾ GIỚI LIÊN QUAN\n${quickTruncate(project.worldSetting, 1200)}` : '';
}

function buildActiveForeshadowings(items?: Foreshadowing[]): string {
  const active = (items || []).filter((item) => !item.isResolved).slice(0, 6);
  return active.length ? `## FORESHADOWING ĐANG MỞ\n${active.map((item) => `- ${item.description}`).join('\n')}` : '';
}

function buildAnchorsSection(anchors: AnchorSet): string {
  const text = JSON.stringify(anchors);
  return text && text !== '{}' ? `## ANCHORS\n${quickTruncate(text, 1000)}` : '';
}

function buildExpectationSection(expectation: ExpectationProfile, branch: SurpriseBranch): string {
  return `## EXPECTATION / BRANCH\n${quickTruncate(JSON.stringify({ expectation, branch }), 1200)}`;
}

function buildTensionSection(_project: Project, targetChapterIndex: number, tensionLevel: TensionLevel, branch: SurpriseBranch): string {
  return `## TENSION\nChapter ${targetChapterIndex}; level=${String(tensionLevel)}; branch=${quickTruncate(JSON.stringify(branch),500)}`;
}

function buildOutputContract(tensionLevel: TensionLevel): string {
  return `## OUTPUT CONTRACT\nGiữ tension=${String(tensionLevel)} nhưng ưu tiên nhân quả, hành vi tự nhiên và giọng truyện; không ép twist/hook nếu không được cảnh tạo ra.`;
}