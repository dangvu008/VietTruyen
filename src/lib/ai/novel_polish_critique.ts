/**
 * File: novel_polish_critique.ts
 * Purpose: Two-agent self-critique loop for novel polishing.
 *          Step 1 (Critic): scans text, returns a structured JSON issue list
 *          across five flaw classes (AI tic / metaphor / consistency / pacing / lexicon).
 *          Step 2 (Surgeon): rewrites ONLY flagged spans using that JSON as the
 *          work order — untouched sentences are preserved byte-for-byte.
 * Layer: Application (AI)
 * Domain: AI -> [novel polishing, critique loop]
 *
 * Design choice: the orchestrator is framework-free. It builds prompts, parses
 * responses, and delegates the actual model call to an injected `runModel`
 * function. That keeps this module testable without the AI client and lets
 * callers pick different models per phase (e.g. strong reasoning for Critic,
 * strong prose for Surgeon).
 */

export type NovelPolishFlawCategory =
    | 'ai_tic'
    | 'metaphor'
    | 'consistency'
    | 'pacing'
    | 'lexicon';

export interface NovelPolishIssue {
    /** Which of the 5 flaw classes this issue belongs to. */
    category: NovelPolishFlawCategory;
    /** Verbatim excerpt from the source text. Must match exactly so Surgeon can locate it. */
    quote: string;
    /** 1-line reason explaining why the quoted span is a problem. */
    reason: string;
    /** 1-line concrete suggestion for how to fix (Surgeon may ignore/override). */
    suggestion: string;
    /** Optional severity signal; Surgeon uses this to decide how aggressive a rewrite should be. */
    severity?: 'low' | 'medium' | 'high';
}

export interface NovelPolishCritiqueReport {
    /** Full list of flagged issues across all 5 categories. */
    issues: NovelPolishIssue[];
    /** Raw critic response text (for debugging / UI display). */
    rawCriticResponse: string;
}

export interface NovelPolishCritiqueInput {
    rawText: string;
    /** Optional context to help the Critic understand setting/era (genre, main characters, etc.). */
    context?: string;
}

export interface NovelPolishSurgeonInput {
    rawText: string;
    issues: NovelPolishIssue[];
    context?: string;
}

export interface RunModelFn {
    (prompt: { system: string; user: string; phase: 'critic' | 'surgeon' }): Promise<string>;
}

export interface NovelPolishCritiqueRunResult {
    issues: NovelPolishIssue[];
    rawCriticResponse: string;
    rewrittenText: string;
    rawSurgeonResponse: string;
}

const VALID_CATEGORIES: ReadonlySet<NovelPolishFlawCategory> = new Set([
    'ai_tic',
    'metaphor',
    'consistency',
    'pacing',
    'lexicon',
]);

const CRITIC_SYSTEM_PROMPT = [
    'Bạn là biên tập viên văn học tiếng Việt, chuyên phát hiện khuyết tật của văn do AI tạo.',
    'Bạn KHÔNG viết lại. Bạn chỉ chỉ ra lỗi và trích nguyên văn.',
    '',
    'QUÉT ĐỦ 5 NHÓM LỖI (không gộp, không bỏ sót):',
    '',
    '1) ai_tic — DẤU VÂN TAY CẤU TRÚC LẶP',
    '   - "không X, không Y, không (cả) Z" xuất hiện >1 lần.',
    '   - Tam đoạn "X, Y, Z" đều độ dài, đều loại từ, lặp cấu trúc.',
    '   - Mở câu bằng cùng một trạng từ ("Rồi", "Đột nhiên", "Bỗng") >=3 lần.',
    '   - Kết đoạn bằng câu tổng kết triết lý ("... như định mệnh an bài").',
    '   NGƯỠNG: mỗi pattern chỉ được phép xuất hiện tối đa 1 lần/chương.',
    '',
    '2) metaphor — THI VỊ HÓA SAI / BỊA LOGIC',
    '   Với mỗi simile/ẩn dụ, áp 3-gate:',
    '   GATE 1 LOGIC: hình ảnh có đúng vật lý/nghĩa đen? (ví dụ "mây đen cuộn lại như vết thương đang lành" SAI: vết thương lành thì khép, không cuộn.)',
    '   GATE 2 SETTING: có hợp genre/era? (ví dụ "ngàn năm im tiếng súng" trong tiên hiệp SAI: không có súng.)',
    '   GATE 3 NECESSITY: bỏ metaphor thì câu có nghèo đi không? Nếu không → thừa.',
    '   Flag mọi metaphor fail ít nhất 1 gate.',
    '',
    '3) consistency — TRẠNG THÁI KHÔNG NHẤT QUÁN',
    '   - Action không có cầu nối (ví dụ "tay trong vạt áo" → ngay câu sau "ngón chân bấm").',
    '   - Vận tốc đổi không lý do (đang chạy → đứng im mà không có chuyển cảnh).',
    '   - Chi tiết được nêu rồi không follow-up (ví dụ "móng tay nhuốm nhầy xanh" xuất hiện 1 lần, biến mất).',
    '   - Lazy transition: POV/scene chuyển mà nhân vật chính không có phản ứng nội tâm hợp lý.',
    '',
    '4) pacing — NHỊP CÂU SAI SCENE TYPE',
    '   Phân loại scene của mỗi đoạn: action / tension / contemplative / dialogue / lore-dump.',
    '   Budget chữ/câu theo scene:',
    '   - action: trung bình 5–10 chữ/câu, variance cao.',
    '   - tension: MIX câu 3 chữ + câu 20–25 chữ để giật nhịp.',
    '   - contemplative: câu 20–30 chữ cho phép.',
    '   - dialogue: 3–12 chữ/câu.',
    '   - lore-dump: 15–25 chữ/câu.',
    '   Flag câu VI PHẠM budget (ví dụ câu 35 chữ suy tư trong scene action đuổi bắt).',
    '',
    '5) lexicon — TỪ NGỮ BỊA / SAI CONTEXT',
    '   - Hán Việt hiếm có thể bịa (ví dụ "mộc mục", "tan biệt" dịch máy từ 消散).',
    '   - Từ công nghệ/hiện đại trong cổ đại (ví dụ "súng", "app", "phản xạ thần kinh").',
    '   - Từ đúng nghĩa nhưng sai đối tượng (ví dụ "lông măng dựng đứng" cho chiến binh — "lông măng" chỉ lông tơ trẻ con/gia cầm non).',
    '   - Hình ảnh bịa bộ phận không tồn tại (ví dụ "gót chân trời").',
    '',
    'OUTPUT: CHỈ JSON hợp lệ, không markdown fence, không lời chào. Cấu trúc:',
    '{',
    '  "issues": [',
    '    {',
    '      "category": "ai_tic" | "metaphor" | "consistency" | "pacing" | "lexicon",',
    '      "quote": "trích NGUYÊN VĂN từ input, KHÔNG paraphrase",',
    '      "reason": "1 câu ngắn",',
    '      "suggestion": "1 câu gợi ý sửa",',
    '      "severity": "low" | "medium" | "high"',
    '    }',
    '  ]',
    '}',
    '',
    'QUY TẮC CỨNG:',
    '- quote PHẢI là substring nguyên văn của input. Nếu paraphrase, Surgeon sẽ không tìm được.',
    '- Không flag câu không vi phạm. Không flag theo "cảm giác".',
    '- Nếu text không có lỗi của một category nào → bỏ category đó, không cần bịa.',
    '- Không vượt quá 30 issue. Chọn các lỗi nghiêm trọng nhất.',
].join('\n');

const SURGEON_SYSTEM_PROMPT = [
    'Bạn là nhà văn tiếng Việt được giao nhiệm vụ sửa lỗi theo đơn của editor.',
    'Bạn CHỈ sửa các câu được flag. Câu không flag giữ nguyên TỪNG KÝ TỰ.',
    '',
    'NGUYÊN TẮC:',
    '1) Đọc danh sách issue. Tìm đúng quote trong text gốc.',
    '2) Với mỗi quote, viết lại bám theo suggestion của editor, áp rule của category:',
    '   - ai_tic → đổi cấu trúc (2 vế thay vì 3, hoặc gộp thành câu đơn).',
    '   - metaphor → BỎ ẩn dụ, thay bằng miêu tả cụ thể. Không thay metaphor này bằng metaphor khác.',
    '   - consistency → thêm cầu nối logic hoặc bỏ chi tiết mâu thuẫn.',
    '   - pacing → cắt câu dài thành câu ngắn (cho action) hoặc xen câu ngắn (cho tension).',
    '   - lexicon → thay từ bằng từ tiếng Việt thông dụng đúng context.',
    '3) Giữ nguyên: sự kiện, nhân vật, POV, thời thái, ý chính.',
    '4) KHÔNG thêm đoạn mới. KHÔNG thêm cảnh mới. KHÔNG thêm nhân vật mới.',
    '5) KHÔNG sửa câu không có trong issue list.',
    '',
    'OUTPUT: CHỈ văn xuôi tiếng Việt đã sửa. Không markdown. Không giải thích. Không liệt kê lại issue.',
].join('\n');

export function buildNovelPolishCriticPrompt(
    input: NovelPolishCritiqueInput,
): { system: string; user: string } {
    const contextBlock = input.context?.trim()
        ? `\nBỐI CẢNH TRUYỆN (dùng để đánh giá setting/era):\n${input.context.trim()}\n`
        : '';

    const user = [
        'Quét văn bản sau theo đủ 5 nhóm lỗi đã mô tả. Trả JSON đúng schema.',
        contextBlock,
        'VĂN BẢN:',
        '"""',
        input.rawText.trim(),
        '"""',
    ].filter(Boolean).join('\n');

    return { system: CRITIC_SYSTEM_PROMPT, user };
}

export function buildNovelPolishSurgeonPrompt(
    input: NovelPolishSurgeonInput,
): { system: string; user: string } {
    const contextBlock = input.context?.trim()
        ? `BỐI CẢNH TRUYỆN:\n${input.context.trim()}\n\n`
        : '';

    const issueBlock = input.issues.length
        ? input.issues
            .map((issue, index) => {
                const severity = issue.severity ? ` [${issue.severity}]` : '';
                return [
                    `#${index + 1} [${issue.category}]${severity}`,
                    `  QUOTE: "${issue.quote}"`,
                    `  REASON: ${issue.reason}`,
                    `  SUGGESTION: ${issue.suggestion}`,
                ].join('\n');
            })
            .join('\n\n')
        : '(không có issue — giữ nguyên toàn bộ text, không sửa gì)';

    const user = [
        contextBlock + 'DANH SÁCH ISSUE CỦA EDITOR (chỉ sửa các quote này):',
        issueBlock,
        '',
        'VĂN BẢN GỐC:',
        '"""',
        input.rawText.trim(),
        '"""',
        '',
        'Xuất văn bản đã sửa. Câu không có trong issue list giữ nguyên tuyệt đối.',
    ].join('\n');

    return { system: SURGEON_SYSTEM_PROMPT, user };
}

/**
 * Extract the first balanced JSON object from a text blob. Critic is told to
 * output raw JSON, but models sometimes prepend a sentence or wrap in markdown.
 */
function extractJsonObject(text: string): string {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const firstBrace = trimmed.indexOf('{');
    if (firstBrace === -1) return '';

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = firstBrace; index < trimmed.length; index++) {
        const char = trimmed[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return trimmed.slice(firstBrace, index + 1);
        }
    }

    return '';
}

export function parseNovelPolishCritiqueResponse(
    responseText: string,
): NovelPolishCritiqueReport {
    const jsonText = extractJsonObject(responseText);
    if (!jsonText) {
        return { issues: [], rawCriticResponse: responseText };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return { issues: [], rawCriticResponse: responseText };
    }

    if (!parsed || typeof parsed !== 'object') {
        return { issues: [], rawCriticResponse: responseText };
    }

    const rawIssues = (parsed as { issues?: unknown }).issues;
    if (!Array.isArray(rawIssues)) {
        return { issues: [], rawCriticResponse: responseText };
    }

    const issues: NovelPolishIssue[] = [];
    for (const raw of rawIssues) {
        if (!raw || typeof raw !== 'object') continue;
        const record = raw as Record<string, unknown>;
        const category = String(record.category || '').trim() as NovelPolishFlawCategory;
        const quote = String(record.quote || '').trim();
        const reason = String(record.reason || '').trim();
        const suggestion = String(record.suggestion || '').trim();
        if (!VALID_CATEGORIES.has(category)) continue;
        if (!quote) continue;
        if (!reason) continue;
        const severity = record.severity === 'low' || record.severity === 'high'
            ? record.severity
            : record.severity === 'medium'
                ? record.severity
                : undefined;
        issues.push({
            category,
            quote,
            reason,
            suggestion: suggestion || '(editor không gợi ý cụ thể — tự quyết)',
            severity,
        });
    }

    return { issues, rawCriticResponse: responseText };
}

/**
 * Validate that critic's quotes actually exist in the source text. Drops issues
 * whose quote cannot be located (prevents Surgeon from hallucinating rewrites).
 */
export function filterIssuesPresentInSource(
    issues: NovelPolishIssue[],
    rawText: string,
): NovelPolishIssue[] {
    return issues.filter((issue) => rawText.includes(issue.quote));
}

/**
 * End-to-end run. Caller injects a `runModel` function so we don't couple this
 * module to any specific AI client.
 */
export async function runNovelPolishCritique(
    input: NovelPolishCritiqueInput,
    runModel: RunModelFn,
): Promise<NovelPolishCritiqueRunResult> {
    const criticPrompt = buildNovelPolishCriticPrompt(input);
    const rawCriticResponse = await runModel({ ...criticPrompt, phase: 'critic' });
    const { issues } = parseNovelPolishCritiqueResponse(rawCriticResponse);
    const verifiedIssues = filterIssuesPresentInSource(issues, input.rawText);

    if (verifiedIssues.length === 0) {
        return {
            issues: [],
            rawCriticResponse,
            rewrittenText: input.rawText,
            rawSurgeonResponse: '',
        };
    }

    const surgeonPrompt = buildNovelPolishSurgeonPrompt({
        rawText: input.rawText,
        issues: verifiedIssues,
        context: input.context,
    });
    const rawSurgeonResponse = await runModel({ ...surgeonPrompt, phase: 'surgeon' });

    return {
        issues: verifiedIssues,
        rawCriticResponse,
        rewrittenText: rawSurgeonResponse.trim(),
        rawSurgeonResponse,
    };
}
