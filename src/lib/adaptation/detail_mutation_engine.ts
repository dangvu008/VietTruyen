/**
 * File: detail_mutation_engine.ts
 * Purpose: Rules biến đổi setting/tone/subplot/pacing/spice/pov/detail cho hybrid adaptation
 * Layer: Application
 * Domain: Adaptation → [hybrid, detail mutation]
 *
 * Data Contract:
 * - Input:  MutationConfig + SkeletonBeat
 * - Output: MutatedBeat (skeleton beat đã được biến đổi theo rules)
 *
 * Logic:
 * - Mỗi MutationRule được apply lên skeleton beat theo category
 * - Rules có intensity (subtle/moderate/dramatic) ảnh hưởng mức độ biến đổi
 * - Preset mutations cung cấp gợi ý nhanh cho user
 * - Engine build prompt directives từ rules để inject vào rewrite prompt
 */

import { createId } from '../../core/id';
import type {
    MutationCategory,
    MutationConfig,
    MutationIntensity,
    MutationRule,
    SkeletonBeat,
} from '../../types/adaptation';

// ─── Preset Mutations ───────────────────────────────────────

export interface MutationPreset {
    id: string;
    label: string;
    description: string;
    category: MutationCategory;
    intensity: MutationIntensity;
    /** Prompt directive mẫu cho AI */
    directive: string;
    tags: string[];
}

/**
 * Preset mutations — gợi ý nhanh cho user chọn.
 * Mỗi preset tạo 1 MutationRule khi user chọn.
 */
export const MUTATION_PRESETS: MutationPreset[] = [
    // ─── Setting ────────────────────────────────────────
    {
        id: 'setting_ancient_to_modern',
        label: 'Cổ đại → Hiện đại',
        description: 'Chuyển bối cảnh từ cổ đại/tiên hiệp sang đời thường hiện đại',
        category: 'setting',
        intensity: 'dramatic',
        directive: 'Chuyển toàn bộ bối cảnh sang thời hiện đại. Thay kiếm bằng công nghệ, thay tu luyện bằng sự nghiệp, thay môn phái bằng công ty/tổ chức.',
        tags: ['thời đại', 'hiện đại hóa'],
    },
    {
        id: 'setting_xianxia_to_scifi',
        label: 'Tiên hiệp → Sci-fi',
        description: 'Chuyển tu tiên thành khoa học viễn tưởng',
        category: 'setting',
        intensity: 'dramatic',
        directive: 'Chuyển hệ thống tu tiên thành công nghệ nâng cấp cơ thể/AI. Linh khí → năng lượng, đan dược → nano-drug, phi kiếm → tàu vũ trụ.',
        tags: ['sci-fi', 'tu tiên'],
    },
    {
        id: 'setting_urban_to_fantasy',
        label: 'Đô thị → Fantasy',
        description: 'Chuyển bối cảnh đô thị sang thế giới fantasy',
        category: 'setting',
        intensity: 'dramatic',
        directive: 'Chuyển bối cảnh đô thị sang thế giới fantasy với phép thuật. Công ty → guild, xe hơi → ngựa/rồng, điện thoại → thủy tinh liên lạc.',
        tags: ['fantasy', 'đô thị'],
    },
    {
        id: 'setting_add_worldbuilding',
        label: 'Thêm world-building',
        description: 'Bổ sung chi tiết thế giới quan: hệ thống quyền lực, văn hóa, địa lý',
        category: 'setting',
        intensity: 'moderate',
        directive: 'Thêm chi tiết world-building: mô tả hệ thống xã hội, quyền lực, phong tục, địa lý cụ thể. Mỗi chương nên có ít nhất 1 chi tiết thế giới quan mới.',
        tags: ['world-building', 'chi tiết'],
    },

    // ─── Tone ───────────────────────────────────────────
    {
        id: 'tone_serious_to_comedy',
        label: 'Nghiêm túc → Hài hước',
        description: 'Thêm yếu tố hài, giảm drama nặng nề',
        category: 'tone',
        intensity: 'moderate',
        directive: 'Thêm yếu tố hài hước: tình huống dở khóc dở cười, đối thoại witty, nhân vật phụ comic relief. Giữ cốt truyện nhưng giảm bi kịch.',
        tags: ['hài', 'nhẹ nhàng'],
    },
    {
        id: 'tone_light_to_dark',
        label: 'Nhẹ nhàng → Dark',
        description: 'Tăng yếu tố u ám, moral ambiguity',
        category: 'tone',
        intensity: 'moderate',
        directive: 'Tăng tone u ám: thêm moral dilemma, hậu quả nặng nề cho quyết định, nhân vật có mặt tối. Không có giải pháp dễ dàng.',
        tags: ['dark', 'u ám'],
    },
    {
        id: 'tone_wholesome',
        label: 'Wholesome / Healing',
        description: 'Chuyển sang tone ấm áp, chữa lành',
        category: 'tone',
        intensity: 'moderate',
        directive: 'Tone ấm áp healing: nhấn mạnh tình cảm, sự quan tâm, những khoảnh khắc bình yên. Giảm xung đột bạo lực, tăng xung đột nội tâm nhẹ nhàng.',
        tags: ['healing', 'ấm áp'],
    },

    // ─── Subplot ────────────────────────────────────────
    {
        id: 'subplot_add_romance',
        label: '+Romance subplot',
        description: 'Thêm tuyến tình cảm lãng mạn',
        category: 'subplot',
        intensity: 'moderate',
        directive: 'Thêm tuyến romance: xây dựng chemistry dần dần, thêm moments lãng mạn tự nhiên, tạo tension tình cảm song song với plot chính.',
        tags: ['romance', 'tình cảm'],
    },
    {
        id: 'subplot_add_mystery',
        label: '+Mystery subplot',
        description: 'Thêm tuyến bí ẩn cần giải đáp',
        category: 'subplot',
        intensity: 'moderate',
        directive: 'Thêm tuyến mystery: rải manh mối từ sớm, tạo câu hỏi chưa giải đáp, thêm nhân vật đáng ngờ. Reveal dần qua các chương.',
        tags: ['mystery', 'bí ẩn'],
    },
    {
        id: 'subplot_add_rivalry',
        label: '+Rivalry subplot',
        description: 'Thêm tuyến đối thủ/cạnh tranh',
        category: 'subplot',
        intensity: 'subtle',
        directive: 'Thêm tuyến rivalry: đối thủ xứng tầm, cạnh tranh lành mạnh hoặc ác ý, push nhân vật chính phát triển.',
        tags: ['rivalry', 'đối thủ'],
    },

    // ─── Pacing ─────────────────────────────────────────
    {
        id: 'pacing_faster',
        label: 'Tăng nhịp',
        description: 'Cắt mô tả dài, tăng action và dialogue',
        category: 'pacing',
        intensity: 'moderate',
        directive: 'Tăng nhịp: câu ngắn hơn, ít mô tả dài dòng, nhiều dialogue và action. Mỗi scene phải có mục đích rõ ràng, cắt filler.',
        tags: ['nhanh', 'action'],
    },
    {
        id: 'pacing_slower',
        label: 'Giảm nhịp',
        description: 'Thêm nội tâm, mô tả cảm xúc chi tiết',
        category: 'pacing',
        intensity: 'moderate',
        directive: 'Giảm nhịp: thêm đoạn nội tâm, mô tả cảm xúc chi tiết, để nhân vật suy ngẫm. Tạo không gian thở giữa các sự kiện.',
        tags: ['chậm', 'nội tâm'],
    },

    // ─── Spice ──────────────────────────────────────────
    {
        id: 'spice_action',
        label: '+Action scenes',
        description: 'Thêm cảnh hành động, chiến đấu',
        category: 'spice',
        intensity: 'moderate',
        directive: 'Thêm action: mỗi vài chương có 1 cảnh chiến đấu/rượt đuổi/nguy hiểm. Miêu tả chi tiết chuyển động, chiến thuật.',
        tags: ['action', 'chiến đấu'],
    },
    {
        id: 'spice_plot_twist',
        label: '+Plot twists',
        description: 'Thêm twist bất ngờ',
        category: 'spice',
        intensity: 'dramatic',
        directive: 'Thêm plot twist: mỗi arc có ít nhất 1 reveal bất ngờ. Foreshadow subtle, twist phải logic nhưng unexpected.',
        tags: ['twist', 'bất ngờ'],
    },
    {
        id: 'spice_emotional_depth',
        label: '+Chiều sâu cảm xúc',
        description: 'Tăng emotional impact, thêm vulnerability',
        category: 'spice',
        intensity: 'subtle',
        directive: 'Tăng chiều sâu cảm xúc: nhân vật thể hiện vulnerability, có moments yếu đuối thật sự. Tránh "mạnh mẽ 24/7".',
        tags: ['cảm xúc', 'sâu sắc'],
    },

    // ─── POV ────────────────────────────────────────────
    {
        id: 'pov_first_person',
        label: 'Đổi sang ngôi 1',
        description: 'Kể chuyện từ ngôi thứ nhất',
        category: 'pov',
        intensity: 'dramatic',
        directive: 'Chuyển sang ngôi 1: "tôi/ta" kể chuyện. Thêm suy nghĩ nội tâm trực tiếp, giới hạn thông tin theo góc nhìn nhân vật.',
        tags: ['ngôi 1', 'POV'],
    },
    {
        id: 'pov_multi_pov',
        label: 'Multi-POV',
        description: 'Xen kẽ góc nhìn nhiều nhân vật',
        category: 'pov',
        intensity: 'dramatic',
        directive: 'Multi-POV: xen kẽ góc nhìn 2-3 nhân vật chính. Mỗi POV có voice riêng, reveal thông tin khác nhau.',
        tags: ['multi-POV', 'đa góc nhìn'],
    },

    // ─── Detail ─────────────────────────────────────────
    {
        id: 'detail_sensory',
        label: '+Miêu tả cảm quan',
        description: 'Thêm chi tiết 5 giác quan',
        category: 'detail',
        intensity: 'subtle',
        directive: 'Thêm miêu tả cảm quan: mùi, vị, xúc giác, âm thanh — không chỉ thị giác. Mỗi scene quan trọng dùng ít nhất 3 giác quan.',
        tags: ['cảm quan', '5 giác quan'],
    },
    {
        id: 'detail_cultural',
        label: '+Chi tiết văn hóa',
        description: 'Thêm phong tục, ẩm thực, lễ hội đặc trưng',
        category: 'detail',
        intensity: 'subtle',
        directive: 'Thêm chi tiết văn hóa: phong tục, ẩm thực, lễ hội, cách xưng hô đặc trưng của bối cảnh. Tạo immersion.',
        tags: ['văn hóa', 'phong tục'],
    },
];

// ─── Mutation Rule Factory ──────────────────────────────────

/**
 * Tạo MutationRule từ preset.
 */
export function createRuleFromPreset(
    preset: MutationPreset,
    applyTo: 'all' | number[] = 'all',
): MutationRule {
    return {
        id: createId(),
        category: preset.category,
        description: preset.directive,
        intensity: preset.intensity,
        applyTo,
    };
}

/**
 * Tạo MutationRule custom từ user input.
 */
export function createCustomRule(
    category: MutationCategory,
    description: string,
    intensity: MutationIntensity = 'moderate',
    applyTo: 'all' | number[] = 'all',
): MutationRule {
    return {
        id: createId(),
        category,
        description,
        intensity,
        applyTo,
    };
}

/**
 * Tạo MutationConfig mặc định (trống).
 */
export function createEmptyMutationConfig(): MutationConfig {
    return {
        rules: [],
        globalDirective: '',
        forbiddenElements: [],
    };
}

// ─── Rule Filtering ─────────────────────────────────────────

/**
 * Lọc rules áp dụng cho chapter cụ thể.
 */
export function getApplicableRules(
    config: MutationConfig,
    chapterIndex: number,
): MutationRule[] {
    return config.rules.filter((rule) => {
        if (rule.applyTo === 'all') return true;
        return rule.applyTo.includes(chapterIndex);
    });
}

/**
 * Nhóm rules theo category.
 */
export function groupRulesByCategory(
    rules: MutationRule[],
): Record<MutationCategory, MutationRule[]> {
    const grouped: Record<MutationCategory, MutationRule[]> = {
        setting: [],
        tone: [],
        subplot: [],
        pacing: [],
        spice: [],
        pov: [],
        detail: [],
    };

    for (const rule of rules) {
        grouped[rule.category].push(rule);
    }

    return grouped;
}

// ─── Prompt Directive Builder ───────────────────────────────

/**
 * Intensity multiplier cho prompt — dramatic rules được nhấn mạnh hơn.
 */
const INTENSITY_PREFIX: Record<MutationIntensity, string> = {
    subtle: '',
    moderate: '[QUAN TRỌNG] ',
    dramatic: '[BẮT BUỘC — ĐỔI HOÀN TOÀN] ',
};

/**
 * Build prompt directives từ MutationConfig cho 1 chapter.
 * Output là đoạn text inject vào system prompt của rewrite engine.
 */
export function buildMutationDirectives(
    config: MutationConfig,
    chapterIndex: number,
): string {
    const applicableRules = getApplicableRules(config, chapterIndex);

    if (applicableRules.length === 0 && !config.globalDirective && config.forbiddenElements.length === 0) {
        return '';
    }

    const sections: string[] = [];

    // Global directive
    if (config.globalDirective.trim()) {
        sections.push(`## Chỉ đạo tổng quát\n${config.globalDirective.trim()}`);
    }

    // Grouped rules
    const grouped = groupRulesByCategory(applicableRules);
    const categoryLabels: Record<MutationCategory, string> = {
        setting: 'Bối cảnh',
        tone: 'Tone/Giọng văn',
        subplot: 'Tuyến phụ',
        pacing: 'Nhịp độ',
        spice: 'Gia vị',
        pov: 'Ngôi kể',
        detail: 'Chi tiết',
    };

    for (const [category, rules] of Object.entries(grouped)) {
        if (rules.length === 0) continue;
        const label = categoryLabels[category as MutationCategory];
        const ruleLines = rules.map(
            (r) => `- ${INTENSITY_PREFIX[r.intensity]}${r.description}`,
        );
        sections.push(`## ${label}\n${ruleLines.join('\n')}`);
    }

    // Forbidden elements
    if (config.forbiddenElements.length > 0) {
        const forbidden = config.forbiddenElements.map((f) => `- KHÔNG ĐƯỢC có: ${f}`);
        sections.push(`## Cấm tuyệt đối\n${forbidden.join('\n')}`);
    }

    return sections.join('\n\n');
}

// ─── Beat Mutation (Abstract) ───────────────────────────────

/**
 * Kết quả sau khi apply mutation lên skeleton beat.
 * Đây là beat đã được "biến đổi" — dùng làm input cho rewrite engine.
 */
export interface MutatedBeat {
    /** Beat gốc */
    original: SkeletonBeat;
    /** Prompt directives cho chapter này */
    directives: string;
    /** Rules đã apply */
    appliedRules: MutationRule[];
    /** Suggested modifications cho plot points (gợi ý, AI sẽ tự quyết) */
    plotModifications: string[];
}

/**
 * Apply mutation rules lên 1 skeleton beat.
 * Không thay đổi beat gốc — tạo MutatedBeat với directives cho AI.
 */
export function applyMutationToBeat(
    beat: SkeletonBeat,
    config: MutationConfig,
): MutatedBeat {
    const applicableRules = getApplicableRules(config, beat.chapterIndex);
    const directives = buildMutationDirectives(config, beat.chapterIndex);
    const plotModifications = derivePlotModifications(beat, applicableRules);

    return {
        original: beat,
        directives,
        appliedRules: applicableRules,
        plotModifications,
    };
}

/**
 * Apply mutations lên toàn bộ skeleton.
 */
export function applyMutationsToSkeleton(
    beats: SkeletonBeat[],
    config: MutationConfig,
): MutatedBeat[] {
    return beats.map((beat) => applyMutationToBeat(beat, config));
}

// ─── Plot Modification Suggestions ─────────────────────────

/**
 * Derive gợi ý thay đổi plot points dựa trên rules.
 * Đây chỉ là suggestions — AI rewrite engine sẽ tự quyết định.
 */
function derivePlotModifications(
    beat: SkeletonBeat,
    rules: MutationRule[],
): string[] {
    const modifications: string[] = [];

    for (const rule of rules) {
        switch (rule.category) {
            case 'setting':
                modifications.push(
                    `Chuyển đổi bối cảnh của các sự kiện: ${rule.description}`,
                );
                break;
            case 'tone':
                modifications.push(
                    `Điều chỉnh tone cảm xúc "${beat.emotionalArc}": ${rule.description}`,
                );
                break;
            case 'subplot':
                modifications.push(
                    `Lồng ghép tuyến phụ vào plot points hiện tại: ${rule.description}`,
                );
                break;
            case 'pacing':
                if (rule.description.includes('tăng') || rule.description.includes('nhanh')) {
                    modifications.push(
                        `Gộp/rút gọn plot points từ ${beat.plotPoints.length} xuống ${Math.max(2, beat.plotPoints.length - 1)}`,
                    );
                } else {
                    modifications.push(
                        `Mở rộng plot points, thêm chi tiết nội tâm giữa các sự kiện`,
                    );
                }
                break;
            case 'spice':
                modifications.push(
                    `Thêm gia vị vào chapter: ${rule.description}`,
                );
                break;
            case 'pov':
                modifications.push(
                    `Đổi góc nhìn kể chuyện: ${rule.description}`,
                );
                break;
            case 'detail':
                modifications.push(
                    `Bổ sung chi tiết: ${rule.description}`,
                );
                break;
        }
    }

    return modifications;
}

// ─── Validation ─────────────────────────────────────────────

export interface MutationValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

/**
 * Validate MutationConfig trước khi chạy rewrite.
 */
export function validateMutationConfig(config: MutationConfig): MutationValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check conflicting rules
    const povRules = config.rules.filter((r) => r.category === 'pov');
    if (povRules.length > 1) {
        warnings.push('Có nhiều rule đổi POV — có thể gây xung đột. Nên chỉ giữ 1.');
    }

    // Check dramatic intensity count
    const dramaticCount = config.rules.filter((r) => r.intensity === 'dramatic').length;
    if (dramaticCount > 3) {
        warnings.push(
            `Có ${dramaticCount} rules "dramatic" — quá nhiều biến đổi mạnh có thể làm mất mạch truyện gốc.`,
        );
    }

    // Check empty config
    if (config.rules.length === 0 && !config.globalDirective.trim()) {
        warnings.push('Chưa có rule nào — output sẽ gần giống skeleton gốc.');
    }

    // Check forbidden vs rules conflict
    for (const rule of config.rules) {
        for (const forbidden of config.forbiddenElements) {
            if (rule.description.toLowerCase().includes(forbidden.toLowerCase())) {
                errors.push(
                    `Rule "${rule.description.slice(0, 40)}..." xung đột với forbidden "${forbidden}"`,
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}
