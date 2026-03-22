/**
 * File: context_builder.ts
 * Purpose: Xây dựng context tối ưu cho AI viết chương — chỉ ~2800 tokens thay vì gửi toàn bộ
 * Layer: Application (AI)
 * Domain: AI → [smart context injection, token optimization]
 *
 * Data Contract:
 * - Input:  Project state (bible, characters, world, chapters, foreshadowings, outline)
 * - Output: Compressed context string ready to inject vào system prompt
 * - Token budget: ~2800 tokens total
 *
 * Architecture:
 *   Bible snapshot    (~500 tokens) — logline, genre, endgame, tone
 *   Characters brief  (~500 tokens) — tên + vai + traits, compressed
 *   World rules       (~300 tokens) — tóm tắt world rules
 *   Recent summaries  (~600 tokens) — 3-5 chương gần nhất (dùng summary)
 *   Previous chapter  (~500 tokens) — nội dung cuối chương trước
 *   Foreshadowings    (~200 tokens) — chỉ chưa resolved
 *   Current beat      (~200 tokens) — outline beat tương ứng
 */
import type { Project, Character, OutlineBeat, Foreshadowing } from '../../types/story';
import type { StyleRule } from '../../types/style_learning';
import { quickTruncate, truncateToTokenLimit } from './token_estimator';
import { buildStyleGuideSection } from './style_learner';

interface WritingContext {
  contextText: string;
  tokenEstimate: number;
  sections: string[];
}

/**
 * Xây context tối ưu cho viết chương mới.
 * @param project - Project hiện tại
 * @param targetChapterIndex - Index chương đang viết (0-based). Dùng để lấy chương trước + outline beat.
 */
export function buildWritingContext(
  project: Project,
  targetChapterIndex: number,
  styleRules?: StyleRule[],
): WritingContext {
  const sections: string[] = [];

  // 1. Bible snapshot (~500 tokens)
  const bible = buildBibleSnapshot(project);
  if (bible) sections.push(bible);

  // 2. Characters brief (~500 tokens)
  const chars = buildCharactersBrief(project.characters);
  if (chars) sections.push(chars);

  // 3. World rules (~300 tokens)
  const world = buildWorldBrief(project);
  if (world) sections.push(world);

  // 4. Recent chapter summaries (~600 tokens)
  const recentSummaries = buildRecentSummaries(project, targetChapterIndex);
  if (recentSummaries) sections.push(recentSummaries);

  // 5. Previous chapter tail (~500 tokens)
  const prevChapter = buildPreviousChapterTail(project, targetChapterIndex);
  if (prevChapter) sections.push(prevChapter);

  // 6. Active foreshadowings (~200 tokens)
  const foreshadowing = buildActiveForeshadowings(project.foreshadowings);
  if (foreshadowing) sections.push(foreshadowing);

  // 7. Current outline beat (~200 tokens)
  const beat = buildCurrentBeat(project.outline, targetChapterIndex);
  if (beat) sections.push(beat);

  // 8. Learned style rules (~300 tokens)
  if (styleRules && styleRules.length > 0) {
    const styleGuide = buildStyleGuideSection(styleRules);
    if (styleGuide) sections.push(styleGuide);
  }

  const contextText = sections.join('\n\n');
  return {
    contextText,
    tokenEstimate: Math.ceil(contextText.length / 3.5),
    sections,
  };
}

// ─── Builder Functions ──────────────────────────────────────

function buildBibleSnapshot(project: Project): string {
  const parts: string[] = ['## BỐI CẢNH TRUYỆN'];
  if (project.title) parts.push(`Tên: ${project.title}`);
  if (project.genre) parts.push(`Thể loại: ${project.genre}`);
  if (project.logline) parts.push(`Logline: ${quickTruncate(project.logline, 200)}`);
  if (project.tone) parts.push(`Giọng văn: ${project.tone}`);
  if (project.writingStyle) parts.push(`Phong cách: ${project.writingStyle}`);
  if (project.endgame) parts.push(`Kết thúc dự kiến: ${quickTruncate(project.endgame, 200)}`);
  if (project.mainPlot) parts.push(`Cốt truyện: ${quickTruncate(project.mainPlot, 400)}`);
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildCharactersBrief(characters: Character[]): string {
  if (characters.length === 0) return '';

  const lines = characters.map((c) => {
    const parts = [`- ${c.name} (${c.role})`];
    if (c.traits) parts.push(`: ${quickTruncate(c.traits, 80)}`);
    if (c.currentStage) parts.push(` [${c.currentStage}]`);
    return parts.join('');
  });

  return `## NHÂN VẬT\n${lines.join('\n')}`;
}

function buildWorldBrief(project: Project): string {
  const w = project.world;
  if (!w) return '';
  const parts: string[] = ['## THẾ GIỚI QUAN'];
  if (w.geography) parts.push(`Bối cảnh: ${quickTruncate(w.geography, 150)}`);
  if (w.magicSystem) parts.push(`Hệ thống: ${quickTruncate(w.magicSystem, 150)}`);
  if (w.rules) parts.push(`Luật: ${quickTruncate(w.rules, 150)}`);
  if (w.factions?.length) parts.push(`Phe phái: ${w.factions.join(', ')}`);
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildRecentSummaries(project: Project, targetIndex: number): string {
  const chapters = project.chapters;
  if (chapters.length === 0) return '';

  // Lấy 5 chương gần nhất trước targetIndex (hoặc cuối mảng)
  const endIdx = Math.min(targetIndex, chapters.length);
  const startIdx = Math.max(0, endIdx - 5);
  const recent = chapters.slice(startIdx, endIdx);

  if (recent.length === 0) return '';

  const lines = recent.map((c, i) => {
    const idx = startIdx + i + 1;
    const summary = c.summary || quickTruncate(c.content, 150);
    return `Ch.${idx} "${c.title}": ${quickTruncate(summary, 200)}`;
  });

  return `## CÁC CHƯƠNG GẦN ĐÂY\n${lines.join('\n')}`;
}

function buildPreviousChapterTail(project: Project, targetIndex: number): string {
  const prevIdx = targetIndex - 1;
  if (prevIdx < 0 || prevIdx >= project.chapters.length) return '';

  const prev = project.chapters[prevIdx];
  // Lấy 1500 ký tự cuối của chương trước
  const tail = prev.content.length > 1500
    ? '…' + prev.content.substring(prev.content.length - 1500)
    : prev.content;

  return `## ĐOẠN CUỐI CHƯƠNG TRƯỚC (Ch.${prevIdx + 1})\n${tail}`;
}

function buildActiveForeshadowings(foreshadowings: Foreshadowing[]): string {
  const active = foreshadowings.filter((f) => !f.isResolved);
  if (active.length === 0) return '';

  const lines = active.map((f) => `- ${quickTruncate(f.description, 100)}`);
  return `## MẦM MỐI CHƯA GIẢI QUYẾT\n${lines.join('\n')}`;
}

function buildCurrentBeat(outline: OutlineBeat[], targetIndex: number): string {
  if (outline.length === 0 || targetIndex >= outline.length) return '';

  const beat = outline[targetIndex];
  if (!beat) return '';

  return `## NHỊP TRUYỆN HIỆN TẠI (Beat ${targetIndex + 1})\nTiêu đề: ${beat.title}\nNội dung: ${quickTruncate(beat.summary, 300)}\nTrọng tâm: ${beat.focus}`;
}
