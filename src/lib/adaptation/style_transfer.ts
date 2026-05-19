/**
 * File: style_transfer.ts
 * Purpose: Học văn phong từ source/reference + anti-AI-tic pass cho hybrid adaptation
 * Layer: Application
 * Domain: Adaptation → [hybrid, style learning, anti-AI-tic]
 *
 * Data Contract:
 * - Input:  StyleSource (from_source | from_reference | preset | custom_prompt) + source text
 * - Output: StyleProfile (sentence patterns, dialogue ratio, vocabulary, etc.)
 *
 * Logic:
 * 1. Phân tích source text → extract StyleProfile tự động
 * 2. User có thể override/tune từng thuộc tính
 * 3. StyleProfile inject vào system prompt của rewrite engine
 * 4. Post-rewrite: chạy anti-AI-tic pass để loại bỏ sáo ngữ AI
 *
 * Integration:
 * - Dùng novel_polish_critique (lexical_surgery mode) cho anti-AI-tic
 * - Dùng callAiModelTracked cho style analysis
 */

import { callAiModelTracked } from '../ai/tracked_ai_client';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { quickTruncate } from '../ai/token_estimator';
import type { StyleProfile, StyleSource } from '../../types/adaptation';

// ─── Style Presets ──────────────────────────────────────────

export interface StylePresetDefinition {
    id: string;
    label: string;
    description: string;
    profile: StyleProfile;
}

export const STYLE_PRESETS: StylePresetDefinition[] = [
    {
        id: 'web_novel_fast',
        label: 'Web novel — nhịp nhanh',
        description: 'Câu ngắn, nhiều dialogue, ít mô tả, đọc nhanh',
        profile: {
            sentenceLength: 'short',
            dialogueRatio: 'heavy',
            descriptionStyle: 'tối giản, chỉ miêu tả khi cần thiết',
            narrativeVoice: 'ngôi 3 hạn chế, gần gũi nhân vật chính',
            vocabularyLevel: 'bình dân, dễ hiểu',
            pacing: 'nhanh, nhiều hành động, ít filler',
            signature: ['câu ngắn gọn', 'dialogue tự nhiên', 'cliffhanger cuối chương'],
            antiPatterns: ['mô tả dài dòng', 'triết lý sâu xa', 'từ ngữ hoa mỹ'],
            exampleParagraphs: [],
        },
    },
    {
        id: 'literary_fiction',
        label: 'Văn chương — nội tâm',
        description: 'Câu dài, nhiều ẩn dụ, nội tâm sâu, văn phong tinh tế',
        profile: {
            sentenceLength: 'long',
            dialogueRatio: 'sparse',
            descriptionStyle: 'miêu tả cảm quan chi tiết, nhiều ẩn dụ',
            narrativeVoice: 'ngôi 3 toàn tri hoặc ngôi 1 thân mật',
            vocabularyLevel: 'văn chương, phong phú',
            pacing: 'chậm, nội tâm, để người đọc cảm nhận',
            signature: ['ẩn dụ thiên nhiên', 'nội tâm sâu', 'câu phức nhiều mệnh đề'],
            antiPatterns: ['câu cụt', 'slang', 'emoji/internet speak'],
            exampleParagraphs: [],
        },
    },
    {
        id: 'genz_casual',
        label: 'Gen Z — thoải mái',
        description: 'Ngôn ngữ trẻ, hài hước, self-aware, meta',
        profile: {
            sentenceLength: 'short',
            dialogueRatio: 'heavy',
            descriptionStyle: 'tối giản, hài hước, self-deprecating',
            narrativeVoice: 'ngôi 1 thân mật, như đang kể chuyện cho bạn',
            vocabularyLevel: 'gen Z, có slang nhưng không quá',
            pacing: 'nhanh, nhảy ý, nhiều aside hài hước',
            signature: ['breaking 4th wall nhẹ', 'so sánh bất ngờ', 'humor tự nhiên'],
            antiPatterns: ['giọng ông cụ', 'từ ngữ cổ', 'mô tả quá nghiêm túc'],
            exampleParagraphs: [],
        },
    },
    {
        id: 'xianxia_classic',
        label: 'Tiên hiệp — cổ kính',
        description: 'Văn phong cổ điển, trang trọng, nhiều thuật ngữ tu tiên',
        profile: {
            sentenceLength: 'mixed',
            dialogueRatio: 'balanced',
            descriptionStyle: 'hùng vĩ, miêu tả cảnh giới và chiến đấu chi tiết',
            narrativeVoice: 'ngôi 3 toàn tri, giọng kể trang trọng',
            vocabularyLevel: 'cổ kính, nhiều thành ngữ và thuật ngữ tu tiên',
            pacing: 'vừa phải, xen kẽ tu luyện và chiến đấu',
            signature: ['thuật ngữ tu tiên', 'miêu tả cảnh giới', 'đối thoại trang trọng'],
            antiPatterns: ['ngôn ngữ hiện đại', 'slang', 'reference pop culture'],
            exampleParagraphs: [],
        },
    },
    {
        id: 'thriller_tense',
        label: 'Thriller — căng thẳng',
        description: 'Câu ngắn khi action, dài khi build tension, nhiều suspense',
        profile: {
            sentenceLength: 'mixed',
            dialogueRatio: 'balanced',
            descriptionStyle: 'chi tiết quan sát, focus vào manh mối và bất thường',
            narrativeVoice: 'ngôi 3 hạn chế, tạo cảm giác bất an',
            vocabularyLevel: 'chính xác, sắc bén',
            pacing: 'xen kẽ nhanh-chậm, build tension rồi release',
            signature: ['câu ngắn khi nguy hiểm', 'chi tiết bất thường', 'cliffhanger'],
            antiPatterns: ['giọng vui vẻ', 'mô tả lãng mạn dài', 'humor không đúng lúc'],
            exampleParagraphs: [],
        },
    },
];

// ─── Style Analysis (AI-powered) ────────────────────────────

const STYLE_ANALYZER_SYSTEM = `Bạn là chuyên gia phân tích văn phong tiếng Việt.
Nhiệm vụ: Phân tích đoạn văn mẫu và trích xuất StyleProfile.

Trả về JSON hợp lệ với cấu trúc:
{
  "sentenceLength": "short" | "mixed" | "long",
  "dialogueRatio": "heavy" | "balanced" | "sparse",
  "descriptionStyle": "mô tả ngắn gọn phong cách miêu tả",
  "narrativeVoice": "mô tả ngôi kể và giọng văn",
  "vocabularyLevel": "mô tả mức độ từ vựng",
  "pacing": "mô tả nhịp độ",
  "signature": ["đặc trưng 1", "đặc trưng 2", "đặc trưng 3"],
  "antiPatterns": ["tránh 1", "tránh 2", "tránh 3"]
}

Phân tích KỸ: độ dài câu trung bình, tỷ lệ dialogue vs narration, từ vựng đặc trưng, cách xây dựng tension, voice riêng.
KHÔNG giải thích. Chỉ trả JSON.`;

/**
 * Phân tích văn phong từ text mẫu bằng AI.
 * Trích xuất StyleProfile tự động.
 */
export async function analyzeStyleFromText(
    sampleText: string,
    options?: { maxSampleLength?: number },
): Promise<StyleProfile> {
    const maxLen = options?.maxSampleLength ?? 8000;
    const truncated = quickTruncate(sampleText, maxLen);

    const aiStore = useAiStore.getState();
    const model = getModelForTask(
        'polish_style',
        aiStore.models,
        undefined,
        aiStore.activeModelId,
        aiStore.taskModelOverrides,
        aiStore.modelHealth,
        [],
        aiStore.preferredProvider,
    );

    if (!model) {
        // Fallback: return basic heuristic profile
        return analyzeStyleHeuristic(sampleText);
    }

    const userPrompt = `Phân tích văn phong của đoạn văn sau:\n\n---\n${truncated}\n---\n\nTrả về StyleProfile JSON.`;

    try {
        const response = await callAiModelTracked({
            provider: model.provider,
            modelId: model.modelId,
            modelName: model.name,
            baseUrl: model.baseUrl,
            systemPrompt: STYLE_ANALYZER_SYSTEM,
            userPrompt,
            taskType: 'polish_style',
            responseFormat: 'json_object',
            skipCache: true,
        });

        const parsed = parseStyleProfileResponse(response);
        // Attach example paragraphs from source
        parsed.exampleParagraphs = extractExampleParagraphs(sampleText);
        return parsed;
    } catch {
        // Fallback to heuristic
        return analyzeStyleHeuristic(sampleText);
    }
}

/**
 * Parse AI response thành StyleProfile.
 */
function parseStyleProfileResponse(response: string): StyleProfile {
    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
        const jsonStr = jsonMatch[1]?.trim() || response.trim();
        const parsed = JSON.parse(jsonStr);

        return {
            sentenceLength: validateEnum(parsed.sentenceLength, ['short', 'mixed', 'long'], 'mixed'),
            dialogueRatio: validateEnum(parsed.dialogueRatio, ['heavy', 'balanced', 'sparse'], 'balanced'),
            descriptionStyle: typeof parsed.descriptionStyle === 'string' ? parsed.descriptionStyle : '',
            narrativeVoice: typeof parsed.narrativeVoice === 'string' ? parsed.narrativeVoice : '',
            vocabularyLevel: typeof parsed.vocabularyLevel === 'string' ? parsed.vocabularyLevel : '',
            pacing: typeof parsed.pacing === 'string' ? parsed.pacing : '',
            signature: Array.isArray(parsed.signature) ? parsed.signature.filter((s: unknown) => typeof s === 'string').slice(0, 5) : [],
            antiPatterns: Array.isArray(parsed.antiPatterns) ? parsed.antiPatterns.filter((s: unknown) => typeof s === 'string').slice(0, 5) : [],
            exampleParagraphs: [],
        };
    } catch {
        return createDefaultStyleProfile();
    }
}

function validateEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
    if (typeof value === 'string' && (allowed as string[]).includes(value)) {
        return value as T;
    }
    return fallback;
}

// ─── Heuristic Style Analysis (no AI) ───────────────────────

/**
 * Phân tích văn phong bằng heuristic — không cần AI call.
 * Dùng khi không có model hoặc làm fallback.
 */
export function analyzeStyleHeuristic(text: string): StyleProfile {
    const sentences = text.split(/[.!?。！？]+/).filter((s) => s.trim().length > 3);
    const avgSentenceLen = sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length
        : 50;

    // Dialogue detection
    const dialogueLines = text.split('\n').filter(
        (line) => /^["「『"—–]/.test(line.trim()) || /^[-–—]\s/.test(line.trim()),
    );
    const totalLines = text.split('\n').filter((l) => l.trim().length > 0).length;
    const dialogueRatio = totalLines > 0 ? dialogueLines.length / totalLines : 0;

    // Sentence length classification
    let sentenceLength: 'short' | 'mixed' | 'long' = 'mixed';
    if (avgSentenceLen < 30) sentenceLength = 'short';
    else if (avgSentenceLen > 60) sentenceLength = 'long';

    // Dialogue ratio classification
    let dialogueClass: 'heavy' | 'balanced' | 'sparse' = 'balanced';
    if (dialogueRatio > 0.5) dialogueClass = 'heavy';
    else if (dialogueRatio < 0.15) dialogueClass = 'sparse';

    return {
        sentenceLength,
        dialogueRatio: dialogueClass,
        descriptionStyle: avgSentenceLen > 50 ? 'miêu tả chi tiết' : 'tối giản',
        narrativeVoice: detectNarrativeVoice(text),
        vocabularyLevel: detectVocabularyLevel(text),
        pacing: sentenceLength === 'short' ? 'nhanh' : sentenceLength === 'long' ? 'chậm, nội tâm' : 'vừa phải',
        signature: [],
        antiPatterns: [],
        exampleParagraphs: extractExampleParagraphs(text),
    };
}

function detectNarrativeVoice(text: string): string {
    const sample = text.slice(0, 3000);
    const firstPersonMarkers = (sample.match(/\b(tôi|ta|mình|tao)\b/g) || []).length;
    const thirdPersonMarkers = (sample.match(/\b(hắn|nàng|y|gã|cô ấy|anh ấy)\b/g) || []).length;

    if (firstPersonMarkers > thirdPersonMarkers * 2) {
        return 'ngôi 1 thân mật';
    }
    return 'ngôi 3';
}

function detectVocabularyLevel(text: string): string {
    const sample = text.slice(0, 5000);
    // Check for classical/literary markers
    const classicalMarkers = (sample.match(/\b(huynh|đệ|tại hạ|bổn|thiếu hiệp|tiên sinh)\b/gi) || []).length;
    const modernMarkers = (sample.match(/\b(ông|bà|anh|chị|bạn|mày|tao)\b/gi) || []).length;

    if (classicalMarkers > 5) return 'cổ kính, trang trọng';
    if (modernMarkers > classicalMarkers * 3) return 'bình dân, hiện đại';
    return 'trung tính';
}

// ─── Example Paragraph Extraction ───────────────────────────

/**
 * Trích xuất 3-5 đoạn văn mẫu đại diện từ source.
 * Chọn đoạn có độ dài vừa phải, đa dạng (dialogue + narration).
 */
export function extractExampleParagraphs(
    text: string,
    count: number = 4,
): string[] {
    const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 80 && p.length <= 500);

    if (paragraphs.length <= count) {
        return paragraphs;
    }

    // Pick diverse paragraphs: some with dialogue, some narration
    const withDialogue = paragraphs.filter(
        (p) => /["「『"—]/.test(p),
    );
    const narration = paragraphs.filter(
        (p) => !/["「『"—]/.test(p),
    );

    const selected: string[] = [];

    // Pick 1-2 dialogue paragraphs
    const dialoguePicks = Math.min(Math.ceil(count / 2), withDialogue.length);
    for (let i = 0; i < dialoguePicks; i++) {
        const idx = Math.floor((i / dialoguePicks) * withDialogue.length);
        selected.push(withDialogue[idx]);
    }

    // Fill rest with narration
    const remaining = count - selected.length;
    for (let i = 0; i < remaining && i < narration.length; i++) {
        const idx = Math.floor((i / remaining) * narration.length);
        selected.push(narration[idx]);
    }

    return selected.slice(0, count);
}

// ─── StyleProfile Resolution ────────────────────────────────

/**
 * Resolve StyleSource thành StyleProfile.
 * Handles tất cả 4 loại source.
 */
export async function resolveStyleProfile(
    styleSource: StyleSource,
    sourceText?: string,
): Promise<StyleProfile> {
    switch (styleSource.type) {
        case 'from_source': {
            if (!sourceText) {
                return createDefaultStyleProfile();
            }
            return analyzeStyleFromText(sourceText);
        }
        case 'from_reference': {
            return analyzeStyleFromText(styleSource.text);
        }
        case 'preset': {
            const preset = STYLE_PRESETS.find((p) => p.id === styleSource.styleId);
            if (preset) return { ...preset.profile };
            return createDefaultStyleProfile();
        }
        case 'custom_prompt': {
            // Custom prompt → tạo profile từ mô tả user
            return buildProfileFromCustomPrompt(styleSource.prompt);
        }
        default:
            return createDefaultStyleProfile();
    }
}

/**
 * Build StyleProfile từ mô tả tự do của user (dùng AI).
 */
async function buildProfileFromCustomPrompt(prompt: string): Promise<StyleProfile> {
    const aiStore = useAiStore.getState();
    const model = getModelForTask(
        'polish_style',
        aiStore.models,
        undefined,
        aiStore.activeModelId,
        aiStore.taskModelOverrides,
        aiStore.modelHealth,
        [],
        aiStore.preferredProvider,
    );

    if (!model) {
        return createDefaultStyleProfile();
    }

    const systemPrompt = `Bạn là chuyên gia văn phong. User mô tả style họ muốn. Hãy chuyển thành StyleProfile JSON.
Trả về JSON hợp lệ với cấu trúc:
{
  "sentenceLength": "short" | "mixed" | "long",
  "dialogueRatio": "heavy" | "balanced" | "sparse",
  "descriptionStyle": "string",
  "narrativeVoice": "string",
  "vocabularyLevel": "string",
  "pacing": "string",
  "signature": ["string"],
  "antiPatterns": ["string"]
}
KHÔNG giải thích. Chỉ JSON.`;

    try {
        const response = await callAiModelTracked({
            provider: model.provider,
            modelId: model.modelId,
            modelName: model.name,
            baseUrl: model.baseUrl,
            systemPrompt,
            userPrompt: `Mô tả style: ${prompt}`,
            taskType: 'polish_style',
            responseFormat: 'json_object',
            skipCache: true,
        });

        return parseStyleProfileResponse(response);
    } catch {
        return createDefaultStyleProfile();
    }
}

// ─── Style Prompt Builder ───────────────────────────────────

/**
 * Build phần style instructions cho rewrite prompt.
 * Inject vào system prompt của hybrid_rewrite_orchestrator.
 */
export function buildStylePromptSection(profile: StyleProfile): string {
    const sections: string[] = [];

    sections.push('## Văn phong yêu cầu');
    sections.push(`- Độ dài câu: ${formatSentenceLength(profile.sentenceLength)}`);
    sections.push(`- Tỷ lệ dialogue: ${formatDialogueRatio(profile.dialogueRatio)}`);

    if (profile.descriptionStyle) {
        sections.push(`- Phong cách miêu tả: ${profile.descriptionStyle}`);
    }
    if (profile.narrativeVoice) {
        sections.push(`- Giọng kể: ${profile.narrativeVoice}`);
    }
    if (profile.vocabularyLevel) {
        sections.push(`- Từ vựng: ${profile.vocabularyLevel}`);
    }
    if (profile.pacing) {
        sections.push(`- Nhịp độ: ${profile.pacing}`);
    }

    if (profile.signature.length > 0) {
        sections.push(`\n### Đặc trưng phải có:`);
        for (const sig of profile.signature) {
            sections.push(`- ${sig}`);
        }
    }

    if (profile.antiPatterns.length > 0) {
        sections.push(`\n### TUYỆT ĐỐI KHÔNG dùng:`);
        for (const anti of profile.antiPatterns) {
            sections.push(`- ❌ ${anti}`);
        }
    }

    if (profile.exampleParagraphs.length > 0) {
        sections.push(`\n### Đoạn văn mẫu (viết GIỐNG phong cách này):`);
        for (let i = 0; i < Math.min(profile.exampleParagraphs.length, 3); i++) {
            sections.push(`\n> ${profile.exampleParagraphs[i].slice(0, 300)}`);
        }
    }

    return sections.join('\n');
}

function formatSentenceLength(len: StyleProfile['sentenceLength']): string {
    switch (len) {
        case 'short': return 'ngắn gọn (15-25 từ/câu)';
        case 'long': return 'dài, phức (40-60+ từ/câu)';
        default: return 'xen kẽ ngắn-dài tự nhiên';
    }
}

function formatDialogueRatio(ratio: StyleProfile['dialogueRatio']): string {
    switch (ratio) {
        case 'heavy': return 'nhiều dialogue (>50% là hội thoại)';
        case 'sparse': return 'ít dialogue (<20%), chủ yếu narration';
        default: return 'cân bằng dialogue và narration';
    }
}

// ─── Anti-AI-Tic Pass ───────────────────────────────────────

/**
 * Danh sách sáo ngữ AI phổ biến trong tiếng Việt.
 * Dùng cho quick detection trước khi gọi AI polish.
 */
export const AI_TIC_PATTERNS: string[] = [
    'ánh mắt sâu thẳm',
    'nụ cười bí ẩn',
    'tim đập thình thịch',
    'không khí đặc quánh',
    'hơi thở nóng rực',
    'đôi mắt long lanh',
    'giọng nói trầm ấm',
    'cảm xúc dâng trào',
    'bầu không khí căng thẳng',
    'ánh nắng xuyên qua',
    'gió nhẹ thổi qua',
    'trái tim rung động',
    'đôi môi mấp máy',
    'ánh mắt kiên định',
    'nắm chặt tay',
    'hít một hơi thật sâu',
    'khóe miệng nhếch lên',
    'đôi mắt đỏ hoe',
    'giọng nói run run',
    'bàn tay run rẩy',
];

/**
 * Quick scan: đếm số lượng AI tics trong text.
 * Dùng để quyết định có cần chạy full anti-AI-tic pass không.
 */
export function countAiTics(text: string): number {
    const lowerText = text.toLowerCase();
    let count = 0;
    for (const pattern of AI_TIC_PATTERNS) {
        const regex = new RegExp(pattern.toLowerCase(), 'g');
        const matches = lowerText.match(regex);
        if (matches) count += matches.length;
    }
    return count;
}

/**
 * Quick replace: thay thế AI tics bằng placeholder.
 * Dùng cho draft nhanh — full polish dùng novel_polish_critique.
 */
export function quickReplaceAiTics(
    text: string,
    profile: StyleProfile,
): { text: string; replacements: number } {
    let result = text;
    let replacements = 0;

    // Only do quick replacement for the most egregious patterns
    const quickReplacements: [RegExp, string][] = [
        [/ánh mắt sâu thẳm/gi, 'ánh mắt'],
        [/nụ cười bí ẩn/gi, 'nụ cười'],
        [/tim đập thình thịch/gi, 'tim đập nhanh'],
        [/không khí đặc quánh/gi, 'không khí nặng nề'],
        [/cảm xúc dâng trào/gi, 'cảm xúc mãnh liệt'],
    ];

    for (const [pattern, replacement] of quickReplacements) {
        const before = result;
        result = result.replace(pattern, replacement);
        if (result !== before) replacements++;
    }

    // If profile has specific antiPatterns, try to detect them
    for (const anti of profile.antiPatterns) {
        if (anti.length > 5 && result.includes(anti)) {
            // Don't auto-replace custom antiPatterns — flag for AI polish
            replacements++;
        }
    }

    return { text: result, replacements };
}

/**
 * Kiểm tra xem text có cần chạy full anti-AI-tic pass không.
 * Threshold: > 2 tics per 1000 chars → cần polish.
 */
export function needsAntiAiTicPass(text: string): boolean {
    const ticCount = countAiTics(text);
    const threshold = Math.max(2, Math.floor(text.length / 1000) * 2);
    return ticCount > threshold;
}

// ─── Utilities ──────────────────────────────────────────────

export function createDefaultStyleProfile(): StyleProfile {
    return {
        sentenceLength: 'mixed',
        dialogueRatio: 'balanced',
        descriptionStyle: '',
        narrativeVoice: '',
        vocabularyLevel: '',
        pacing: '',
        signature: [],
        antiPatterns: [],
        exampleParagraphs: [],
    };
}

/**
 * Merge user overrides vào StyleProfile.
 * User có thể tune từng field mà không cần re-analyze.
 */
export function mergeStyleOverrides(
    base: StyleProfile,
    overrides: Partial<StyleProfile>,
): StyleProfile {
    return {
        ...base,
        ...overrides,
        // Arrays: merge instead of replace
        signature: overrides.signature ?? base.signature,
        antiPatterns: [
            ...base.antiPatterns,
            ...(overrides.antiPatterns ?? []),
        ].filter((v, i, arr) => arr.indexOf(v) === i), // dedupe
        exampleParagraphs: overrides.exampleParagraphs ?? base.exampleParagraphs,
    };
}
