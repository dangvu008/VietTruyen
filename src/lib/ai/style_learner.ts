/**
 * File: style_learner.ts
 * Purpose: Tổng hợp accepted corrections thành Style Rules + render rules vào prompt
 * Layer: Application (AI)
 * Domain: StyleLearning → [rule synthesis, prompt injection]
 *
 * Data Contract:
 * - Input:  StyleCorrection[] (accepted) + StyleRule[] (existing)
 * - Output: StyleRule[] (synthesized) | string (prompt section)
 * - Consumer: context_builder.ts (inject into writing prompt)
 *
 * Flow: Gom corrections by category → AI tổng hợp pattern → Update weights → Return rules
 * Edge Cases: 0 accepted corrections → return existing rules unchanged
 */
import { callAiModelTracked } from './tracked_ai_client';
import { getModelForTask } from './model_router';
import { useAiStore } from '../../store/use_ai_store';
import { createId } from '../../core/id';
import { quickTruncate } from './token_estimator';
import type { StyleCorrection, StyleRule, StyleCategory, StyleExample } from '../../types/style_learning';

const SYNTHESIZER_SYSTEM = `Bạn là chuyên gia ngôn ngữ học Việt Nam.
Nhiệm vụ: Phân tích danh sách lỗi văn phong đã được chấp nhận và tổng hợp thành QUY TẮC VIẾT.
Mỗi quy tắc phải:
- Mô tả PATTERN lỗi chung (không chỉ 1 case cụ thể)
- Đưa ra GỢI Ý cách viết tốt hơn
- Kèm 2-3 ví dụ cụ thể (gốc → sửa)
LUÔN trả về JSON hợp lệ. Không giải thích ngoài JSON.`;

/**
 * Tổng hợp accepted corrections thành rules mới hoặc update rules cũ.
 * Gọi AI để phát hiện pattern chung.
 */
export async function synthesizeRules(
  acceptedCorrections: StyleCorrection[],
  existingRules: StyleRule[],
  projectId: string,
): Promise<StyleRule[]> {
  if (acceptedCorrections.length === 0) return existingRules;

  const aiStore = useAiStore.getState();
  const model = getModelForTask(
    'polish_style',
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides
  );

  if (!model) {
    throw new Error('Không tìm thấy AI model.');
  }

  const userPrompt = buildSynthesisPrompt(acceptedCorrections, existingRules);

  const response = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: SYNTHESIZER_SYSTEM,
    userPrompt,
    taskType: 'polish_style',
    responseFormat: 'json_object',
    skipCache: true,
  });

  return parseSynthesisResponse(response, projectId, existingRules);
}

function buildSynthesisPrompt(
  corrections: StyleCorrection[],
  existingRules: StyleRule[],
): string {
  // Group corrections by category
  const grouped: Record<string, StyleCorrection[]> = {};
  for (const c of corrections) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  const correctionLines = Object.entries(grouped).map(([cat, items]) => {
    const examples = items.slice(0, 5).map(
      (c) => `  - "${quickTruncate(c.original, 80)}" → "${quickTruncate(c.corrected, 80)}" (${c.explanation})`
    );
    return `[${cat}] (${items.length} lỗi):\n${examples.join('\n')}`;
  });

  let existingSection = '';
  if (existingRules.length > 0) {
    const ruleLines = existingRules.map(
      (r) => `- [${r.category}] ${r.pattern} → ${r.suggestion} (weight: ${r.weight})`
    );
    existingSection = `\n\nQUY TẮC ĐÃ CÓ (merge/update nếu trùng, thêm mới nếu khác):\n${ruleLines.join('\n')}`;
  }

  return `Phân tích các lỗi văn phong đã được user CHẤP NHẬN sửa:

${correctionLines.join('\n\n')}
${existingSection}

Tổng hợp thành danh sách QUY TẮC VIẾT. Trả về JSON:
{
  "rules": [
    {
      "category": "spelling|grammar|word_choice|sentence_flow|repetition|tone_mismatch|dialogue|pacing",
      "pattern": "Mô tả pattern lỗi chung (VD: 'Dùng từ \"rằng là\" thừa trong câu kể')",
      "suggestion": "Cách viết tốt hơn (VD: 'Bỏ \"rằng\" hoặc \"là\", giữ 1 trong 2')",
      "examples": [
        { "original": "Anh ta nói rằng là anh sẽ đi", "corrected": "Anh ta nói rằng anh sẽ đi" }
      ],
      "isExisting": false
    }
  ]
}

Nếu 1 rule mới overlap với rule cũ → set "isExisting": true + merge ví dụ.
Tạo tối đa 10 rules. Ưu tiên patterns xuất hiện nhiều lần.`;
}

function parseSynthesisResponse(
  response: string,
  projectId: string,
  existingRules: StyleRule[],
): StyleRule[] {
  try {
    const data = JSON.parse(response);
    const now = new Date().toISOString();
    const existingMap = new Map(existingRules.map((r) => [r.pattern.toLowerCase(), r]));

    const rules: StyleRule[] = (data.rules || []).map((r: any) => {
      const patternKey = String(r.pattern || '').toLowerCase();
      const existing = r.isExisting ? existingMap.get(patternKey) : undefined;

      const examples: StyleExample[] = (r.examples || []).map((e: any) => ({
        original: String(e.original || ''),
        corrected: String(e.corrected || ''),
      })).filter((e: StyleExample) => e.original && e.corrected);

      if (existing) {
        // Merge: bump weight, add new examples
        return {
          ...existing,
          suggestion: String(r.suggestion || existing.suggestion),
          examples: dedupeExamples([...existing.examples, ...examples]).slice(0, 5),
          weight: Math.min(1, existing.weight + 0.1),
          updatedAt: now,
        };
      }

      return {
        id: createId(),
        projectId,
        category: validateCategory(r.category),
        pattern: String(r.pattern || ''),
        suggestion: String(r.suggestion || ''),
        examples: examples.slice(0, 3),
        weight: 0.3, // starting weight
        createdAt: now,
        updatedAt: now,
      };
    }).filter((r: StyleRule) => r.pattern && r.suggestion);

    // Keep existing rules that weren't updated
    const updatedIds = new Set(rules.filter((r: StyleRule) => existingRules.some((e) => e.id === r.id)).map((r: StyleRule) => r.id));
    const keptExisting = existingRules.filter((r) => !updatedIds.has(r.id));

    return [...keptExisting, ...rules];
  } catch {
    return existingRules; // fallback: return existing unchanged
  }
}

/**
 * Render top-N style rules (sorted by weight) vào prompt section.
 * Inject vào context_builder cho AI viết chapter.
 * Budget: ~300 tokens.
 */
export function buildStyleGuideSection(rules: StyleRule[], maxRules = 10): string {
  if (rules.length === 0) return '';

  // Sort by weight desc, take top N
  const sorted = [...rules].sort((a, b) => b.weight - a.weight).slice(0, maxRules);

  const lines = sorted.map((r) => {
    const example = r.examples[0];
    const exStr = example ? ` VD: "${quickTruncate(example.original, 40)}" → "${quickTruncate(example.corrected, 40)}"` : '';
    return `- KHÔNG: ${quickTruncate(r.pattern, 60)}. THAY: ${quickTruncate(r.suggestion, 60)}.${exStr}`;
  });

  return `## HƯỚNG DẪN VĂN PHONG (đã học)\n${lines.join('\n')}`;
}

// ─── Helpers ────────────────────────────────────────────────

const VALID_CATEGORIES: StyleCategory[] = [
  'spelling', 'grammar', 'word_choice', 'sentence_flow',
  'repetition', 'tone_mismatch', 'dialogue', 'pacing',
];

function validateCategory(raw: string): StyleCategory {
  if (VALID_CATEGORIES.includes(raw as StyleCategory)) return raw as StyleCategory;
  return 'word_choice';
}

function dedupeExamples(examples: StyleExample[]): StyleExample[] {
  const seen = new Set<string>();
  return examples.filter((e) => {
    const key = e.original.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
