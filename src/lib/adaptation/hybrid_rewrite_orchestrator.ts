/**
 * File: hybrid_rewrite_orchestrator.ts
 * Purpose: Điều phối AI rewrite per-chapter cho hybrid adaptation
 * Layer: Application
 * Domain: Adaptation → [hybrid, rewrite orchestration]
 *
 * Data Contract:
 * - Input:  HybridAdaptationConfig + StorySkeleton + source text (for originality check)
 * - Output: RewrittenChapter[] (progressive, chapter-by-chapter)
 *
 * Flow per chapter:
 * 1. Build prompt từ skeleton beat + character map + mutations + style profile + previous memory
 * 2. AI generate chapter mới
 * 3. Anti-AI-tic pass (quick replace + optional full polish)
 * 4. Originality check vs source
 * 5. Nếu fail → regenerate với stronger mutation (max 2 retries)
 *
 * CRITICAL RULES:
 * - KHÔNG bao giờ include source prose trong prompt
 * - Chỉ include skeleton beats (abstract structure)
 * - Yêu cầu AI viết hoàn toàn mới, KHÔNG paraphrase
 */

import type {
    CharacterMappingTable,
    HybridAdaptationConfig,
    MutationConfig,
    OriginalityReport,
    SkeletonBeat,
    StyleProfile,
} from '../../types/adaptation';
import { buildMutationDirectives } from './detail_mutation_engine';
import { buildStylePromptSection, needsAntiAiTicPass, quickReplaceAiTics } from './style_transfer';
import { scoreOriginality } from './originality_scorer';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { quickTruncate } from '../ai/token_estimator';

// ─── Types ──────────────────────────────────────────────────

export interface RewritePromptContext {
    skeleton: SkeletonBeat;
    characterMap: CharacterMappingTable;
    mutations: MutationConfig;
    styleProfile: StyleProfile;
    previousChapterSummary: string;
    globalContext: string;
}

export interface RewrittenChapter {
    chapterIndex: number;
    title: string;
    content: string;
    /** Summary cho chapter tiếp theo dùng làm context */
    summary: string;
    /** Originality report cho chapter này */
    originalityReport: OriginalityReport;
    /** Số lần retry (0 = pass lần đầu) */
    retryCount: number;
    /** Có chạy anti-AI-tic pass không */
    antiAiTicApplied: boolean;
}

export interface RewriteProgress {
    currentChapter: number;
    totalChapters: number;
    status: 'generating' | 'checking_originality' | 'retrying' | 'polishing' | 'done' | 'failed';
    message: string;
}

export interface RewriteSessionConfig {
    /** Source text per chapter — dùng cho originality check, KHÔNG inject vào prompt */
    sourceChapterTexts: string[];
    /** Adaptation config đầy đủ */
    adaptationConfig: HybridAdaptationConfig;
    /** Callback khi có progress update */
    onProgress?: (progress: RewriteProgress) => void;
    /** Callback khi 1 chapter hoàn thành */
    onChapterComplete?: (chapter: RewrittenChapter) => void;
    /** AbortSignal để user cancel */
    signal?: AbortSignal;
    /** Max retries per chapter khi fail originality (default: 2) */
    maxRetries?: number;
    /** Có chạy full anti-AI-tic pass không (default: true) */
    enableAntiAiTic?: boolean;
    /** Target word count per chapter (optional) */
    targetWordCount?: number;
}

// ─── Constants ──────────────────────────────────────────────

const MAX_RETRIES_DEFAULT = 2;
const DEFAULT_TARGET_WORDS = 2500;

// ─── Main Orchestrator ──────────────────────────────────────

/**
 * Orchestrate full rewrite session — viết lại tất cả chapters.
 * Progressive: emit từng chapter khi hoàn thành.
 */
export async function runRewriteSession(
    config: RewriteSessionConfig,
): Promise<RewrittenChapter[]> {
    const {
        adaptationConfig,
        sourceChapterTexts,
        onProgress,
        onChapterComplete,
        signal,
        maxRetries = MAX_RETRIES_DEFAULT,
        enableAntiAiTic = true,
        targetWordCount = DEFAULT_TARGET_WORDS,
    } = config;

    const { skeleton, characterMap, mutations, styleProfile } = adaptationConfig;
    const resolvedStyle = styleProfile ?? {
        sentenceLength: 'mixed' as const,
        dialogueRatio: 'balanced' as const,
        descriptionStyle: '',
        narrativeVoice: '',
        vocabularyLevel: '',
        pacing: '',
        signature: [],
        antiPatterns: [],
        exampleParagraphs: [],
    };

    const results: RewrittenChapter[] = [];
    let previousSummary = '';

    for (let i = 0; i < skeleton.beats.length; i++) {
        // Check abort
        if (signal?.aborted) {
            break;
        }

        const beat = skeleton.beats[i];
        const sourceText = sourceChapterTexts[i] ?? '';

        onProgress?.({
            currentChapter: i + 1,
            totalChapters: skeleton.beats.length,
            status: 'generating',
            message: `Đang viết chương ${i + 1}/${skeleton.beats.length}...`,
        });

        const chapter = await rewriteSingleChapter({
            beat,
            characterMap,
            mutations,
            styleProfile: resolvedStyle,
            previousChapterSummary: previousSummary,
            globalContext: buildGlobalContext(skeleton, characterMap),
            sourceText,
            chapterIndex: i,
            maxRetries,
            enableAntiAiTic,
            targetWordCount,
            signal,
            onProgress: (status, message) => {
                onProgress?.({
                    currentChapter: i + 1,
                    totalChapters: skeleton.beats.length,
                    status,
                    message,
                });
            },
        });

        results.push(chapter);
        previousSummary = chapter.summary;
        onChapterComplete?.(chapter);
    }

    onProgress?.({
        currentChapter: skeleton.beats.length,
        totalChapters: skeleton.beats.length,
        status: 'done',
        message: `Hoàn thành ${results.length}/${skeleton.beats.length} chương.`,
    });

    return results;
}

// ─── Single Chapter Rewrite ─────────────────────────────────

interface SingleChapterConfig {
    beat: SkeletonBeat;
    characterMap: CharacterMappingTable;
    mutations: MutationConfig;
    styleProfile: StyleProfile;
    previousChapterSummary: string;
    globalContext: string;
    sourceText: string;
    chapterIndex: number;
    maxRetries: number;
    enableAntiAiTic: boolean;
    targetWordCount: number;
    signal?: AbortSignal;
    onProgress?: (status: RewriteProgress['status'], message: string) => void;
}

async function rewriteSingleChapter(config: SingleChapterConfig): Promise<RewrittenChapter> {
    const {
        beat,
        characterMap,
        mutations,
        styleProfile,
        previousChapterSummary,
        globalContext,
        sourceText,
        chapterIndex,
        maxRetries,
        enableAntiAiTic,
        targetWordCount,
        signal,
        onProgress,
    } = config;

    let retryCount = 0;
    let mutationBoost = 0; // Tăng intensity khi retry

    while (retryCount <= maxRetries) {
        if (signal?.aborted) {
            return createFailedChapter(chapterIndex, 'Đã hủy bởi người dùng');
        }

        // Build prompt
        const prompt = buildRewritePrompt({
            beat,
            characterMap,
            mutations,
            styleProfile,
            previousChapterSummary,
            globalContext,
            targetWordCount,
            mutationBoost,
        });

        // Generate
        const rawContent = await callRewriteModel(prompt, signal);

        if (!rawContent) {
            return createFailedChapter(chapterIndex, 'AI không trả về kết quả');
        }

        // Anti-AI-tic pass
        let content = rawContent;
        let antiAiTicApplied = false;

        if (enableAntiAiTic && needsAntiAiTicPass(content)) {
            onProgress?.('polishing', `Chương ${chapterIndex + 1}: đang loại bỏ sáo ngữ AI...`);
            const result = quickReplaceAiTics(content, styleProfile);
            content = result.text;
            antiAiTicApplied = result.replacements > 0;
        }

        // Originality check
        onProgress?.('checking_originality', `Chương ${chapterIndex + 1}: kiểm tra độ khác biệt...`);
        const report = scoreOriginality(sourceText, content);

        if (report.verdict === 'pass' || report.verdict === 'review') {
            // Generate summary for next chapter context
            const summary = generateChapterSummary(content, beat);

            return {
                chapterIndex,
                title: `Chương ${chapterIndex + 1}`,
                content,
                summary,
                originalityReport: report,
                retryCount,
                antiAiTicApplied,
            };
        }

        // Fail → retry with stronger mutation
        retryCount++;
        mutationBoost++;
        onProgress?.('retrying', `Chương ${chapterIndex + 1}: quá giống gốc, viết lại lần ${retryCount}...`);
    }

    // Max retries exceeded — return last attempt with warning
    const lastContent = await callRewriteModel(
        buildRewritePrompt({
            beat,
            characterMap,
            mutations,
            styleProfile,
            previousChapterSummary,
            globalContext,
            targetWordCount,
            mutationBoost: maxRetries + 1,
        }),
        signal,
    );

    const finalContent = lastContent ?? '';
    const finalReport = scoreOriginality(sourceText, finalContent);

    return {
        chapterIndex,
        title: `Chương ${chapterIndex + 1}`,
        content: finalContent,
        summary: generateChapterSummary(finalContent, beat),
        originalityReport: finalReport,
        retryCount: maxRetries + 1,
        antiAiTicApplied: false,
    };
}

// ─── Prompt Construction ────────────────────────────────────

interface PromptBuildConfig {
    beat: SkeletonBeat;
    characterMap: CharacterMappingTable;
    mutations: MutationConfig;
    styleProfile: StyleProfile;
    previousChapterSummary: string;
    globalContext: string;
    targetWordCount: number;
    mutationBoost: number;
}

function buildRewritePrompt(config: PromptBuildConfig): { system: string; user: string } {
    const {
        beat,
        characterMap,
        mutations,
        styleProfile,
        previousChapterSummary,
        globalContext,
        targetWordCount,
        mutationBoost,
    } = config;

    // ─── System Prompt ──────────────────────────────────
    const systemParts: string[] = [
        'Bạn là tiểu thuyết gia sáng tạo. Nhiệm vụ: VIẾT MỘT CHƯƠNG TRUYỆN HOÀN TOÀN MỚI.',
        '',
        '## QUY TẮC CỨNG',
        '1. KHÔNG paraphrase — viết hoàn toàn mới, sáng tạo riêng',
        '2. KHÔNG copy cấu trúc câu từ bất kỳ nguồn nào',
        '3. Dùng plot points như NGUỒN CẢM HỨNG, không phải template',
        '4. Tạo dialogue, miêu tả, và chi tiết 100% mới',
        '5. Giữ nhất quán với nhân vật và bối cảnh đã cho',
        '',
    ];

    // Style section
    const styleSection = buildStylePromptSection(styleProfile);
    if (styleSection) {
        systemParts.push(styleSection);
        systemParts.push('');
    }

    // Mutation directives
    const mutationDirectives = buildMutationDirectives(mutations, beat.chapterIndex);
    if (mutationDirectives) {
        systemParts.push('## Biến đổi yêu cầu');
        systemParts.push(mutationDirectives);
        systemParts.push('');
    }

    // Mutation boost (khi retry)
    if (mutationBoost > 0) {
        systemParts.push(`## ⚠️ YÊU CẦU ĐẶC BIỆT (lần viết lại #${mutationBoost})`);
        systemParts.push(`Lần trước output quá giống nguồn gốc. Lần này PHẢI:`);
        systemParts.push(`- Thay đổi HOÀN TOÀN cách diễn đạt`);
        systemParts.push(`- Đổi thứ tự sự kiện nếu có thể`);
        systemParts.push(`- Thêm chi tiết sáng tạo riêng (${mutationBoost * 30}% nội dung mới)`);
        systemParts.push(`- Dùng cấu trúc câu khác hẳn`);
        systemParts.push('');
    }

    // Word count
    systemParts.push(`## Độ dài: ~${targetWordCount} từ`);

    const system = systemParts.join('\n');

    // ─── User Prompt ────────────────────────────────────
    const userParts: string[] = [];

    // Global context
    if (globalContext) {
        userParts.push(`## Bối cảnh tổng quát\n${globalContext}\n`);
    }

    // Previous chapter summary (continuity)
    if (previousChapterSummary) {
        userParts.push(`## Chương trước (tóm tắt)\n${previousChapterSummary}\n`);
    }

    // Character map
    const charSection = buildCharacterSection(characterMap);
    if (charSection) {
        userParts.push(charSection);
    }

    // Skeleton beat (ABSTRACT — no prose)
    userParts.push(buildBeatSection(beat));

    // Final instruction
    userParts.push('\n---\nViết chương truyện hoàn chỉnh dựa trên skeleton ở trên. Sáng tạo tự do, KHÔNG copy/paraphrase.');

    return {
        system,
        user: userParts.join('\n'),
    };
}

function buildCharacterSection(characterMap: CharacterMappingTable): string {
    if (characterMap.mappings.length === 0) return '';

    const lines: string[] = ['## Nhân vật'];

    for (const mapping of characterMap.mappings) {
        lines.push(`- **${mapping.targetName}**: ${mapping.targetBackground}`);
        if (mapping.personalityDelta) {
            lines.push(`  Tính cách: ${mapping.personalityDelta}`);
        }
        if (mapping.speechStyle) {
            lines.push(`  Cách nói: ${mapping.speechStyle}`);
        }
    }

    return lines.join('\n') + '\n';
}

function buildBeatSection(beat: SkeletonBeat): string {
    const lines: string[] = [
        `## Skeleton — Chương ${beat.chapterIndex + 1}`,
        `Mục đích: ${formatPurpose(beat.purpose)}`,
        `Cung cảm xúc: ${beat.emotionalArc}`,
        '',
        '### Plot points (nguồn cảm hứng, KHÔNG copy):',
    ];

    for (const point of beat.plotPoints) {
        lines.push(`- ${point}`);
    }

    if (beat.characterActions.length > 0) {
        lines.push('');
        lines.push('### Hành động nhân vật:');
        for (const action of beat.characterActions) {
            lines.push(`- [${action.role}] ${action.action}`);
        }
    }

    if (beat.hooks.length > 0) {
        lines.push('');
        lines.push('### Hooks/Foreshadowing:');
        for (const hook of beat.hooks) {
            lines.push(`- ${hook}`);
        }
    }

    return lines.join('\n');
}

function formatPurpose(purpose: SkeletonBeat['purpose']): string {
    const labels: Record<typeof purpose, string> = {
        setup: 'Giới thiệu / Thiết lập',
        rising: 'Phát triển / Leo thang',
        conflict: 'Xung đột chính',
        climax: 'Cao trào',
        falling: 'Hạ nhiệt / Hậu quả',
        resolution: 'Giải quyết / Kết thúc',
    };
    return labels[purpose] || purpose;
}

// ─── Global Context Builder ─────────────────────────────────

function buildGlobalContext(
    skeleton: HybridAdaptationConfig['skeleton'],
    characterMap: CharacterMappingTable,
): string {
    const parts: string[] = [];

    if (skeleton.globalArc) {
        parts.push(`Arc tổng: ${skeleton.globalArc}`);
    }
    if (skeleton.thematicCore) {
        parts.push(`Chủ đề cốt lõi: ${skeleton.thematicCore}`);
    }

    const mainChars = characterMap.mappings
        .slice(0, 5)
        .map((m) => m.targetName)
        .join(', ');
    if (mainChars) {
        parts.push(`Nhân vật chính: ${mainChars}`);
    }

    return parts.join('\n');
}

// ─── AI Model Call ──────────────────────────────────────────

async function callRewriteModel(
    prompt: { system: string; user: string },
    _signal?: AbortSignal,
): Promise<string | null> {
    const aiStore = useAiStore.getState();
    const model = getModelForTask(
        'write_chapter',
        aiStore.models,
        undefined,
        aiStore.activeModelId,
        aiStore.taskModelOverrides,
        aiStore.modelHealth,
        [],
        aiStore.preferredProvider,
    );

    if (!model) {
        return null;
    }

    try {
        const response = await callAiModelTracked({
            provider: model.provider,
            modelId: model.modelId,
            modelName: model.name,
            baseUrl: model.baseUrl,
            systemPrompt: prompt.system,
            userPrompt: prompt.user,
            taskType: 'write_chapter',
            skipCache: true,
        });

        return response && response.trim().length > 100 ? response : null;
    } catch {
        return null;
    }
}

// ─── Chapter Summary Generation ─────────────────────────────

/**
 * Generate summary ngắn gọn cho chapter — dùng làm context cho chapter tiếp theo.
 * Dùng heuristic (không cần AI) để tiết kiệm token.
 */
function generateChapterSummary(content: string, beat: SkeletonBeat): string {
    // Heuristic: lấy plot points từ beat + first/last paragraph
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 20);

    const parts: string[] = [];

    // Beat purpose
    parts.push(`[${formatPurpose(beat.purpose)}]`);

    // Plot points (đã có sẵn từ skeleton)
    if (beat.plotPoints.length > 0) {
        parts.push(beat.plotPoints.slice(0, 3).join('; '));
    }

    // Last paragraph hint (truncated)
    if (paragraphs.length > 0) {
        const lastPara = paragraphs[paragraphs.length - 1];
        parts.push(`Kết: ${quickTruncate(lastPara, 100)}`);
    }

    return parts.join(' | ');
}

// ─── Utilities ──────────────────────────────────────────────

function createFailedChapter(chapterIndex: number, reason: string): RewrittenChapter {
    return {
        chapterIndex,
        title: `Chương ${chapterIndex + 1}`,
        content: `[Lỗi: ${reason}]`,
        summary: '',
        originalityReport: {
            overallScore: 0,
            lexicalOverlap: 0,
            structuralSimilarity: 0,
            semanticDistance: 0,
            flaggedPassages: [],
            verdict: 'fail',
        },
        retryCount: 0,
        antiAiTicApplied: false,
    };
}

// ─── Batch Utilities ────────────────────────────────────────

/**
 * Estimate cost cho toàn bộ rewrite session.
 * Dùng để hiển thị cho user trước khi bắt đầu.
 */
export function estimateRewriteCost(
    beatCount: number,
    targetWordCount: number = DEFAULT_TARGET_WORDS,
): { estimatedTokens: number; estimatedChapters: number } {
    // Rough estimate: prompt ~2000 tokens + output ~targetWordCount*1.5 tokens
    const tokensPerChapter = 2000 + Math.ceil(targetWordCount * 1.5);
    return {
        estimatedTokens: tokensPerChapter * beatCount,
        estimatedChapters: beatCount,
    };
}

/**
 * Rewrite 1 chapter đơn lẻ (cho user muốn rewrite lại chapter cụ thể).
 */
export async function rewriteSingleChapterStandalone(opts: {
    beat: SkeletonBeat;
    characterMap: CharacterMappingTable;
    mutations: MutationConfig;
    styleProfile: StyleProfile;
    previousChapterSummary: string;
    sourceText: string;
    signal?: AbortSignal;
}): Promise<RewrittenChapter> {
    const { beat, characterMap, mutations, styleProfile, previousChapterSummary, sourceText, signal } = opts;

    return rewriteSingleChapter({
        beat,
        characterMap,
        mutations,
        styleProfile,
        previousChapterSummary,
        globalContext: '',
        sourceText,
        chapterIndex: beat.chapterIndex,
        maxRetries: MAX_RETRIES_DEFAULT,
        enableAntiAiTic: true,
        targetWordCount: DEFAULT_TARGET_WORDS,
        signal,
    });
}
