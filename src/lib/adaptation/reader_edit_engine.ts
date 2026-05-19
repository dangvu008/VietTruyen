/**
 * File: reader_edit_engine.ts
 * Purpose: Smart find-replace + targeted AI edits cho Reader-Edit mode
 * Layer: Application
 * Domain: Adaptation → [reader-edit, personal customization]
 *
 * Use case: Người đọc import truyện, muốn sửa vài chi tiết cho phù hợp sở thích cá nhân.
 * KHÔNG phải để publish — chỉ để đọc cá nhân.
 *
 * Features:
 * - Smart character rename (hiểu ngữ cảnh: xưng hô, biệt danh, đại từ)
 * - Targeted scene edit (sửa đoạn cụ thể theo yêu cầu)
 * - Relationship transform (đổi kiểu quan hệ giữa nhân vật)
 * - Scene skip/replace (bỏ hoặc thay thế scene không thích)
 */

import { createId } from '../../core/id';

// ─── Types ──────────────────────────────────────────────────

export type ReaderEditType =
    | 'rename'           // Đổi tên nhân vật
    | 'scene_edit'       // Sửa đoạn cụ thể
    | 'relationship'     // Đổi kiểu quan hệ
    | 'scene_skip'       // Bỏ scene
    | 'detail_change'    // Đổi chi tiết nhỏ (ngoại hình, tính cách, v.v.)
    | 'tone_shift';      // Đổi tone đoạn văn

export interface ReaderEditRule {
    id: string;
    type: ReaderEditType;
    /** Mô tả ngắn cho user nhận diện */
    label: string;
    /** Config cụ thể theo type */
    config: RenameConfig | SceneEditConfig | RelationshipConfig | SceneSkipConfig | DetailChangeConfig | ToneShiftConfig;
    /** Áp dụng cho chapters nào — undefined = tất cả */
    applyToChapters?: number[];
    enabled: boolean;
}

export interface RenameConfig {
    type: 'rename';
    originalName: string;
    newName: string;
    /** Các biến thể tên cần đổi (biệt danh, xưng hô) */
    aliases: string[];
    /** Biến thể tên mới tương ứng */
    newAliases: string[];
    /** Đổi cả đại từ giới tính nếu đổi gender */
    genderSwap?: { from: 'male' | 'female'; to: 'male' | 'female' };
}

export interface SceneEditConfig {
    type: 'scene_edit';
    /** Đoạn text gốc cần sửa (hoặc mô tả vị trí) */
    targetDescription: string;
    /** Yêu cầu sửa */
    editInstruction: string;
    /** Nếu có exact quote, dùng để locate chính xác */
    exactQuote?: string;
}

export interface RelationshipConfig {
    type: 'relationship';
    character1: string;
    character2: string;
    originalRelation: string;   // "người yêu", "tình địch"
    newRelation: string;        // "bạn thân", "đồng minh"
    /** Mức độ sửa: chỉ xưng hô hay cả hành vi */
    depth: 'surface' | 'behavioral';
}

export interface SceneSkipConfig {
    type: 'scene_skip';
    /** Mô tả scene cần bỏ */
    sceneDescription: string;
    /** Thay bằng tóm tắt ngắn hay bỏ hoàn toàn */
    replacement: 'summary' | 'remove' | 'custom';
    customReplacement?: string;
}

export interface DetailChangeConfig {
    type: 'detail_change';
    /** Chi tiết gốc */
    originalDetail: string;
    /** Chi tiết mới */
    newDetail: string;
    /** Phạm vi: chỉ mention đầu tiên hay tất cả */
    scope: 'first' | 'all';
}

export interface ToneShiftConfig {
    type: 'tone_shift';
    /** Đoạn cần đổi tone */
    targetDescription: string;
    /** Tone mới */
    newTone: string;  // "hài hước hơn", "bớt dark", "thêm lãng mạn"
}

// ─── Reader Edit Session ────────────────────────────────────

export interface ReaderEditSession {
    id: string;
    projectId: string;
    rules: ReaderEditRule[];
    createdAt: string;
    updatedAt: string;
}

export function createReaderEditSession(projectId: string): ReaderEditSession {
    const now = new Date().toISOString();
    return {
        id: createId(),
        projectId,
        rules: [],
        createdAt: now,
        updatedAt: now,
    };
}

// ─── Smart Rename Engine ────────────────────────────────────

/**
 * Vietnamese-aware character rename.
 * Handles: tên đầy đủ, tên gọi, biệt danh, xưng hô liên quan.
 */
export function applySmartRename(
    text: string,
    config: RenameConfig,
): string {
    let result = text;

    // 1. Replace exact name (case-sensitive)
    result = replaceAll(result, config.originalName, config.newName);

    // 2. Replace aliases
    for (let i = 0; i < config.aliases.length; i++) {
        const alias = config.aliases[i];
        const newAlias = config.newAliases[i] || config.newName;
        if (alias && newAlias) {
            result = replaceAll(result, alias, newAlias);
        }
    }

    // 3. Gender swap pronouns if needed
    if (config.genderSwap) {
        result = applyGenderSwap(result, config.originalName, config.newName, config.genderSwap);
    }

    return result;
}

/**
 * Áp dụng tất cả rename rules lên text.
 */
export function applyAllRenames(text: string, rules: ReaderEditRule[]): string {
    let result = text;

    const renameRules = rules.filter(
        (r): r is ReaderEditRule & { config: RenameConfig } =>
            r.type === 'rename' && r.enabled && r.config.type === 'rename',
    );

    // Sort by name length descending to avoid partial replacements
    const sorted = [...renameRules].sort(
        (a, b) => b.config.originalName.length - a.config.originalName.length,
    );

    for (const rule of sorted) {
        result = applySmartRename(result, rule.config);
    }

    return result;
}

// ─── Vietnamese Gender Pronouns ─────────────────────────────

const MALE_TO_FEMALE: Record<string, string> = {
    'anh': 'cô',
    'hắn': 'nàng',
    'gã': 'ả',
    'chàng': 'nàng',
    'y': 'thị',
    'thằng': 'con',
};

const FEMALE_TO_MALE: Record<string, string> = {
    'cô': 'anh',
    'nàng': 'hắn',
    'ả': 'gã',
    'thị': 'y',
    'mụ': 'gã',
    'con bé': 'thằng bé',
};

function applyGenderSwap(
    text: string,
    originalName: string,
    _newName: string,
    swap: { from: 'male' | 'female'; to: 'male' | 'female' },
): string {
    if (swap.from === swap.to) return text;

    let result = text;
    const map = swap.from === 'male' ? MALE_TO_FEMALE : FEMALE_TO_MALE;

    // Only swap pronouns that appear near the character's name (within 100 chars)
    for (const [original, replacement] of Object.entries(map)) {
        // Pattern: pronoun appears within context of the character
        const contextPattern = buildProximityPattern(original, originalName);
        result = result.replace(contextPattern, (match) => {
            return match.replace(new RegExp(`\\b${escapeRegex(original)}\\b`, 'g'), replacement);
        });
    }

    return result;
}

function buildProximityPattern(pronoun: string, name: string): RegExp {
    // Match sentences containing both the pronoun and the name (or nearby)
    const escaped = escapeRegex(pronoun);
    const nameEscaped = escapeRegex(name);
    // Look for pronoun in sentences that mention the name
    return new RegExp(
        `[^.!?。]*(?:${nameEscaped})[^.!?。]*(?:${escaped})[^.!?。]*[.!?。]|[^.!?。]*(?:${escaped})[^.!?。]*(?:${nameEscaped})[^.!?。]*[.!?。]`,
        'gi',
    );
}

// ─── Detail Change (Simple Find-Replace) ────────────────────

/**
 * Áp dụng detail changes — find-replace đơn giản nhưng context-aware.
 */
export function applyDetailChanges(text: string, rules: ReaderEditRule[]): string {
    let result = text;

    const detailRules = rules.filter(
        (r): r is ReaderEditRule & { config: DetailChangeConfig } =>
            r.type === 'detail_change' && r.enabled && r.config.type === 'detail_change',
    );

    for (const rule of detailRules) {
        const { originalDetail, newDetail, scope } = rule.config;
        if (scope === 'first') {
            result = result.replace(originalDetail, newDetail);
        } else {
            result = replaceAll(result, originalDetail, newDetail);
        }
    }

    return result;
}

// ─── Scene Skip ─────────────────────────────────────────────

/**
 * Áp dụng scene skip — tìm và bỏ/thay thế scene.
 * Dùng exact quote nếu có, nếu không thì cần AI locate.
 */
export function applySceneSkips(text: string, rules: ReaderEditRule[]): { text: string; aiNeeded: SceneSkipConfig[] } {
    let result = text;
    const aiNeeded: SceneSkipConfig[] = [];

    const skipRules = rules.filter(
        (r): r is ReaderEditRule & { config: SceneSkipConfig } =>
            r.type === 'scene_skip' && r.enabled && r.config.type === 'scene_skip',
    );

    for (const rule of skipRules) {
        const { sceneDescription, replacement, customReplacement } = rule.config;

        // Try to find by description as literal text
        if (result.includes(sceneDescription)) {
            if (replacement === 'remove') {
                result = result.replace(sceneDescription, '');
            } else if (replacement === 'custom' && customReplacement) {
                result = result.replace(sceneDescription, customReplacement);
            } else {
                result = result.replace(sceneDescription, `[Đoạn này đã được lược bỏ]`);
            }
        } else {
            // Can't find exact text — need AI to locate the scene
            aiNeeded.push(rule.config);
        }
    }

    return { text: result, aiNeeded };
}

// ─── Full Apply Pipeline ────────────────────────────────────

export interface ReaderEditResult {
    text: string;
    appliedCount: number;
    aiNeededEdits: Array<SceneEditConfig | SceneSkipConfig | RelationshipConfig | ToneShiftConfig>;
}

/**
 * Áp dụng tất cả reader edit rules lên chapter text.
 * Rules không cần AI (rename, detail_change) được apply ngay.
 * Rules cần AI (scene_edit, relationship behavioral, tone_shift) được collect để gọi AI sau.
 */
export function applyReaderEdits(
    text: string,
    rules: ReaderEditRule[],
    chapterIndex?: number,
): ReaderEditResult {
    // Filter rules applicable to this chapter
    const applicableRules = rules.filter((r) => {
        if (!r.enabled) return false;
        if (r.applyToChapters && chapterIndex != null) {
            return r.applyToChapters.includes(chapterIndex);
        }
        return true;
    });

    let result = text;
    let appliedCount = 0;
    const aiNeededEdits: ReaderEditResult['aiNeededEdits'] = [];

    // 1. Apply renames (no AI needed)
    const beforeRename = result;
    result = applyAllRenames(result, applicableRules);
    if (result !== beforeRename) appliedCount++;

    // 2. Apply detail changes (no AI needed)
    const beforeDetail = result;
    result = applyDetailChanges(result, applicableRules);
    if (result !== beforeDetail) appliedCount++;

    // 3. Apply scene skips (may need AI)
    const skipResult = applySceneSkips(result, applicableRules);
    result = skipResult.text;
    if (skipResult.aiNeeded.length > 0) {
        aiNeededEdits.push(...skipResult.aiNeeded);
    } else if (result !== skipResult.text) {
        appliedCount++;
    }

    // 4. Collect AI-needed edits
    for (const rule of applicableRules) {
        if (rule.type === 'scene_edit' && rule.config.type === 'scene_edit') {
            aiNeededEdits.push(rule.config);
        }
        if (rule.type === 'relationship' && rule.config.type === 'relationship' && rule.config.depth === 'behavioral') {
            aiNeededEdits.push(rule.config);
        }
        if (rule.type === 'tone_shift' && rule.config.type === 'tone_shift') {
            aiNeededEdits.push(rule.config);
        }
    }

    return { text: result, appliedCount, aiNeededEdits };
}

// ─── AI Prompt Builders for Reader Edit ─────────────────────

/**
 * Build prompt cho AI khi cần sửa scene cụ thể.
 * AI chỉ sửa đoạn được chỉ định, giữ nguyên phần còn lại.
 */
export function buildSceneEditPrompt(
    chapterText: string,
    edit: SceneEditConfig,
): string {
    const lines = [
        'Bạn là editor giúp người đọc customize truyện cho sở thích cá nhân.',
        'Sửa ĐÚNG đoạn được chỉ định, giữ NGUYÊN phần còn lại.',
        '',
        '## Yêu cầu sửa',
        `Đoạn cần sửa: ${edit.targetDescription}`,
        `Cách sửa: ${edit.editInstruction}`,
    ];

    if (edit.exactQuote) {
        lines.push(`Trích dẫn chính xác: "${edit.exactQuote}"`);
    }

    lines.push(
        '',
        '## Quy tắc',
        '- CHỈ sửa đoạn được chỉ định. Giữ nguyên 100% phần còn lại.',
        '- Giữ nguyên văn phong, giọng kể, nhịp câu của tác giả.',
        '- Đảm bảo logic mạch truyện vẫn thông suốt sau khi sửa.',
        '- Output: toàn bộ chapter text với đoạn đã sửa.',
        '',
        '## Nội dung chương:',
        '---',
        chapterText,
    );

    return lines.join('\n');
}

/**
 * Build prompt cho AI khi cần đổi relationship ở mức behavioral.
 */
export function buildRelationshipEditPrompt(
    chapterText: string,
    edit: RelationshipConfig,
): string {
    return [
        'Bạn là editor giúp người đọc customize truyện.',
        `Đổi quan hệ giữa "${edit.character1}" và "${edit.character2}":`,
        `- Quan hệ gốc: ${edit.originalRelation}`,
        `- Quan hệ mới: ${edit.newRelation}`,
        '',
        '## Quy tắc',
        '- Sửa hành vi, lời thoại, suy nghĩ liên quan đến quan hệ này.',
        '- Giữ nguyên các sự kiện chính — chỉ đổi CÁCH nhân vật tương tác.',
        '- Giữ nguyên văn phong tác giả.',
        '- Nếu có cảnh thân mật không phù hợp quan hệ mới → đổi thành tương tác phù hợp.',
        '',
        '## Nội dung chương:',
        '---',
        chapterText,
    ].join('\n');
}

/**
 * Build prompt cho AI khi cần đổi tone.
 */
export function buildToneShiftPrompt(
    chapterText: string,
    edit: ToneShiftConfig,
): string {
    return [
        'Bạn là editor giúp người đọc customize truyện.',
        `Đổi tone đoạn: ${edit.targetDescription}`,
        `Tone mới: ${edit.newTone}`,
        '',
        '## Quy tắc',
        '- CHỈ đổi tone/cảm xúc, KHÔNG đổi sự kiện.',
        '- Giữ nguyên nhân vật, hành động, kết quả.',
        '- Giữ nguyên văn phong tác giả ở phần không sửa.',
        '',
        '## Nội dung chương:',
        '---',
        chapterText,
    ].join('\n');
}

// ─── Rule Builders (convenience) ────────────────────────────

export function createRenameRule(
    originalName: string,
    newName: string,
    options?: {
        aliases?: string[];
        newAliases?: string[];
        genderSwap?: RenameConfig['genderSwap'];
    },
): ReaderEditRule {
    return {
        id: createId(),
        type: 'rename',
        label: `Đổi "${originalName}" → "${newName}"`,
        config: {
            type: 'rename',
            originalName,
            newName,
            aliases: options?.aliases || [],
            newAliases: options?.newAliases || [],
            genderSwap: options?.genderSwap,
        },
        enabled: true,
    };
}

export function createSceneEditRule(
    targetDescription: string,
    editInstruction: string,
    exactQuote?: string,
): ReaderEditRule {
    return {
        id: createId(),
        type: 'scene_edit',
        label: `Sửa: ${targetDescription.slice(0, 50)}...`,
        config: {
            type: 'scene_edit',
            targetDescription,
            editInstruction,
            exactQuote,
        },
        enabled: true,
    };
}

export function createRelationshipRule(
    character1: string,
    character2: string,
    originalRelation: string,
    newRelation: string,
    depth: 'surface' | 'behavioral' = 'surface',
): ReaderEditRule {
    return {
        id: createId(),
        type: 'relationship',
        label: `${character1} ↔ ${character2}: ${originalRelation} → ${newRelation}`,
        config: {
            type: 'relationship',
            character1,
            character2,
            originalRelation,
            newRelation,
            depth,
        },
        enabled: true,
    };
}

export function createSceneSkipRule(
    sceneDescription: string,
    replacement: 'summary' | 'remove' | 'custom' = 'remove',
    customReplacement?: string,
): ReaderEditRule {
    return {
        id: createId(),
        type: 'scene_skip',
        label: `Bỏ: ${sceneDescription.slice(0, 50)}...`,
        config: {
            type: 'scene_skip',
            sceneDescription,
            replacement,
            customReplacement,
        },
        enabled: true,
    };
}

export function createDetailChangeRule(
    originalDetail: string,
    newDetail: string,
    scope: 'first' | 'all' = 'all',
): ReaderEditRule {
    return {
        id: createId(),
        type: 'detail_change',
        label: `"${originalDetail.slice(0, 30)}" → "${newDetail.slice(0, 30)}"`,
        config: {
            type: 'detail_change',
            originalDetail,
            newDetail,
            scope,
        },
        enabled: true,
    };
}

export function createToneShiftRule(
    targetDescription: string,
    newTone: string,
): ReaderEditRule {
    return {
        id: createId(),
        type: 'tone_shift',
        label: `Tone: ${newTone.slice(0, 40)}`,
        config: {
            type: 'tone_shift',
            targetDescription,
            newTone,
        },
        enabled: true,
    };
}

// ─── Utilities ──────────────────────────────────────────────

function replaceAll(text: string, search: string, replacement: string): string {
    if (!search) return text;
    const escaped = escapeRegex(search);
    return text.replace(new RegExp(escaped, 'g'), replacement);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
