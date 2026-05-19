/**
 * File: skeleton_extractor.ts
 * Purpose: Trích xuất "xương sống" câu chuyện từ source — chỉ giữ cấu trúc, không giữ prose
 * Layer: Application
 * Domain: Adaptation → [hybrid, skeleton extraction]
 */

import type { Chapter } from '../../types/story';
import type {
    CharacterRole,
    SkeletonBeat,
    SkeletonBeatPurpose,
    SkeletonCharacterAction,
    StorySkeleton,
} from '../../types/adaptation';

// ─── Constants ──────────────────────────────────────────────

const MIN_CHAPTER_LENGTH_FOR_ANALYSIS = 200;

// ─── Heuristic Skeleton Extraction (no AI) ──────────────────

/**
 * Trích xuất skeleton từ chapters bằng heuristic — không cần AI call.
 * Dùng cho preview nhanh trước khi user confirm chạy AI extraction.
 */
export function extractSkeletonHeuristic(chapters: Chapter[]): StorySkeleton {
    const beats: SkeletonBeat[] = chapters
        .filter((ch) => (ch.content?.length ?? 0) >= MIN_CHAPTER_LENGTH_FOR_ANALYSIS)
        .map((chapter, idx) => extractBeatHeuristic(chapter, idx, chapters.length));

    const tensionCurve = buildTensionCurve(beats);

    return {
        beats,
        globalArc: inferGlobalArc(beats),
        thematicCore: '',
        tensionCurve,
    };
}

function extractBeatHeuristic(
    chapter: Chapter,
    index: number,
    totalChapters: number,
): SkeletonBeat {
    const content = chapter.content || '';
    const purpose = inferPurpose(content, index, totalChapters);
    const plotPoints = extractPlotPoints(content);
    const characterActions = extractCharacterActions(content);
    const emotionalArc = inferEmotionalArc(content);
    const hooks = extractHooks(content);

    return {
        chapterIndex: chapter.sequenceNumber ?? index,
        purpose,
        plotPoints,
        characterActions,
        emotionalArc,
        hooks,
    };
}

function inferPurpose(
    _content: string,
    index: number,
    total: number,
): SkeletonBeatPurpose {
    const position = index / Math.max(total - 1, 1);

    // Position-based heuristic (3-act structure)
    if (position < 0.15) return 'setup';
    if (position < 0.35) return 'rising';
    if (position < 0.55) return 'conflict';
    if (position < 0.75) return 'climax';
    if (position < 0.9) return 'falling';
    return 'resolution';
}

function extractPlotPoints(content: string): string[] {
    // Trích xuất câu đầu mỗi đoạn lớn làm plot point placeholder
    const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim().length > 50);
    const points: string[] = [];

    for (const para of paragraphs.slice(0, 5)) {
        const firstSentence = para.split(/[.!?。！？]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
            points.push(firstSentence);
        }
    }

    return points.length > 0 ? points : ['[Cần AI phân tích chi tiết]'];
}

function extractCharacterActions(content: string): SkeletonCharacterAction[] {
    // Placeholder — real extraction cần AI hoặc NER
    // Detect tên riêng đơn giản bằng pattern: từ viết hoa liên tiếp
    const namePattern = /(?:^|\s)([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s[A-ZÀ-Ỹ][a-zà-ỹ]+){0,2})/g;
    const names = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = namePattern.exec(content)) !== null) {
        const name = match[1].trim();
        if (name.length > 1 && name.length < 30) {
            names.add(name);
        }
    }

    const uniqueNames = Array.from(names).slice(0, 5);
    return uniqueNames.map((name, idx) => ({
        characterId: `detected_${idx}`,
        role: (idx === 0 ? 'protagonist' : 'support') as CharacterRole,
        action: `[Hành động của ${name} — cần AI phân tích]`,
    }));
}

function inferEmotionalArc(content: string): string {
    const length = content.length;
    if (length < 500) return 'ngắn gọn';

    // Simple sentiment heuristic based on Vietnamese emotional keywords
    const positiveWords = ['vui', 'hạnh phúc', 'cười', 'yêu', 'hy vọng', 'thắng', 'thành công'];
    const negativeWords = ['buồn', 'đau', 'khóc', 'chết', 'thất bại', 'tuyệt vọng', 'sợ'];

    const lowerContent = content.toLowerCase();
    const posCount = positiveWords.filter((w) => lowerContent.includes(w)).length;
    const negCount = negativeWords.filter((w) => lowerContent.includes(w)).length;

    if (posCount > negCount + 2) return 'tích cực, lạc quan';
    if (negCount > posCount + 2) return 'u ám, căng thẳng';
    if (posCount > 0 && negCount > 0) return 'đan xen cảm xúc';
    return 'trung tính';
}

function extractHooks(content: string): string[] {
    const hooks: string[] = [];
    const lines = content.split('\n').filter((l) => l.trim());

    // Last line often contains cliffhanger
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine && (lastLine.endsWith('...') || lastLine.endsWith('?') || lastLine.endsWith('!'))) {
        hooks.push(lastLine.slice(0, 100));
    }

    return hooks;
}

function buildTensionCurve(beats: SkeletonBeat[]): number[] {
    const purposeTension: Record<SkeletonBeatPurpose, number> = {
        setup: 2,
        rising: 4,
        conflict: 7,
        climax: 9,
        falling: 5,
        resolution: 3,
    };

    return beats.map((beat) => purposeTension[beat.purpose] ?? 5);
}

function inferGlobalArc(beats: SkeletonBeat[]): string {
    if (beats.length === 0) return '';

    const purposes = beats.map((b) => b.purpose);
    const hasClimax = purposes.includes('climax');
    const hasResolution = purposes.includes('resolution');

    if (hasClimax && hasResolution) {
        return 'Cấu trúc hoàn chỉnh: setup → conflict → climax → resolution';
    }
    if (hasClimax) {
        return 'Đang phát triển: có cao trào nhưng chưa kết thúc';
    }
    return 'Đang mở: chưa đạt cao trào';
}

// ─── AI-Assisted Skeleton Extraction ────────────────────────

/**
 * Prompt template cho AI extraction — dùng khi user muốn skeleton chính xác hơn.
 * Caller sẽ gọi AI service với prompt này.
 */
export function buildSkeletonExtractionPrompt(chapterContent: string, chapterIndex: number): string {
    return [
        'Phân tích chương truyện sau và trích xuất CẤU TRÚC (không copy nguyên văn).',
        '',
        'Output JSON:',
        '{',
        '  "purpose": "setup|rising|conflict|climax|falling|resolution",',
        '  "plotPoints": ["3-5 bullet mô tả SỰ KIỆN chính, viết lại bằng lời của bạn"],',
        '  "characterActions": [{"name": "tên", "role": "protagonist|antagonist|catalyst|observer|support", "action": "mô tả hành động 1 câu"}],',
        '  "emotionalArc": "mô tả cung cảm xúc trong chương, VD: từ bình yên → hoang mang → quyết tâm",',
        '  "hooks": ["foreshadowing hoặc cliffhanger nếu có"]',
        '}',
        '',
        'QUY TẮC:',
        '- KHÔNG copy nguyên văn từ truyện. Viết lại bằng lời tóm tắt.',
        '- plotPoints là SỰ KIỆN xảy ra, không phải miêu tả.',
        '- Mỗi plotPoint tối đa 1 câu ngắn.',
        '- characterActions chỉ liệt kê nhân vật CÓ HÀNH ĐỘNG QUAN TRỌNG trong chương.',
        '',
        `Chương ${chapterIndex + 1}:`,
        '---',
        chapterContent.slice(0, 8000), // Limit context window
    ].join('\n');
}

/**
 * Parse AI response thành SkeletonBeat.
 * Tolerant parsing — fallback to heuristic nếu AI output không hợp lệ.
 */
export function parseSkeletonBeatFromAI(
    raw: unknown,
    chapterIndex: number,
): SkeletonBeat {
    const fallback: SkeletonBeat = {
        chapterIndex,
        purpose: 'rising',
        plotPoints: ['[AI parse failed — cần retry]'],
        characterActions: [],
        emotionalArc: '',
        hooks: [],
    };

    if (!raw || typeof raw !== 'object') return fallback;

    const obj = raw as Record<string, unknown>;

    const validPurposes: SkeletonBeatPurpose[] = ['setup', 'rising', 'conflict', 'climax', 'falling', 'resolution'];
    const purpose = validPurposes.includes(obj.purpose as SkeletonBeatPurpose)
        ? (obj.purpose as SkeletonBeatPurpose)
        : 'rising';

    const plotPoints = Array.isArray(obj.plotPoints)
        ? obj.plotPoints.filter((p): p is string => typeof p === 'string' && p.length > 0).slice(0, 7)
        : fallback.plotPoints;

    const characterActions: SkeletonCharacterAction[] = Array.isArray(obj.characterActions)
        ? obj.characterActions
            .filter((a): a is Record<string, unknown> => a != null && typeof a === 'object')
            .map((a, idx) => ({
                characterId: String(a.name || `char_${idx}`),
                role: (['protagonist', 'antagonist', 'catalyst', 'observer', 'support'].includes(
                    String(a.role),
                )
                    ? String(a.role)
                    : 'support') as CharacterRole,
                action: String(a.action || ''),
            }))
            .filter((a) => a.action.length > 0)
        : [];

    const emotionalArc = typeof obj.emotionalArc === 'string' ? obj.emotionalArc : '';
    const hooks = Array.isArray(obj.hooks)
        ? obj.hooks.filter((h): h is string => typeof h === 'string' && h.length > 0)
        : [];

    return { chapterIndex, purpose, plotPoints, characterActions, emotionalArc, hooks };
}

/**
 * Assemble full StorySkeleton từ array of beats (sau khi AI extract xong tất cả chapters).
 */
export function assembleStorySkeleton(beats: SkeletonBeat[]): StorySkeleton {
    const sorted = [...beats].sort((a, b) => a.chapterIndex - b.chapterIndex);
    const tensionCurve = buildTensionCurve(sorted);

    return {
        beats: sorted,
        globalArc: inferGlobalArc(sorted),
        thematicCore: '', // Cần AI call riêng hoặc user input
        tensionCurve,
    };
}
