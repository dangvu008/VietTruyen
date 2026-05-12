import { describe, expect, it, vi } from 'vitest';

import {
    buildNovelPolishCriticPrompt,
    buildNovelPolishSurgeonPrompt,
    filterIssuesPresentInSource,
    parseNovelPolishCritiqueResponse,
    runNovelPolishCritique,
    type NovelPolishIssue,
    type RunModelFn,
} from './novel_polish_critique';

describe('novel_polish_critique — Critic prompt', () => {
    it('includes all five flaw categories with concrete examples', () => {
        const { system, user } = buildNovelPolishCriticPrompt({
            rawText: 'Không gợn sóng, không tiếng gió, không cả tiếng thủy thủ.',
        });

        // All 5 categories must be present in the rubric.
        expect(system).toContain('1) ai_tic');
        expect(system).toContain('2) metaphor');
        expect(system).toContain('3) consistency');
        expect(system).toContain('4) pacing');
        expect(system).toContain('5) lexicon');

        // Budgets + gates must be explicit (not slogans).
        expect(system).toContain('3-gate');
        expect(system).toContain('5–10 chữ');
        expect(system).toContain('20–30 chữ');
        expect(system).toContain('1 lần/chương');

        // User message carries the raw text verbatim.
        expect(user).toContain('Không gợn sóng, không tiếng gió, không cả tiếng thủy thủ.');
        expect(user).toContain('JSON');
    });

    it('appends story context when provided so Critic can judge setting/era', () => {
        const { user } = buildNovelPolishCriticPrompt({
            rawText: 'Hắn rút kiếm ra khỏi bao.',
            context: 'Genre: tiên hiệp cổ đại. Không có công nghệ hiện đại.',
        });

        expect(user).toContain('BỐI CẢNH TRUYỆN');
        expect(user).toContain('tiên hiệp cổ đại');
    });
});

describe('novel_polish_critique — Critic response parsing', () => {
    it('parses a clean JSON response into typed issues', () => {
        const response = JSON.stringify({
            issues: [
                {
                    category: 'ai_tic',
                    quote: 'không gợn sóng, không tiếng gió, không cả tiếng thủy thủ',
                    reason: 'Tam đoạn phủ định lặp.',
                    suggestion: 'Đổi thành câu 2 vế.',
                    severity: 'high',
                },
                {
                    category: 'metaphor',
                    quote: 'mây đen cuộn lại như vết thương đang lành',
                    reason: 'Vết thương lành thì khép, không cuộn — sai logic.',
                    suggestion: 'Bỏ ẩn dụ, miêu tả mây cụ thể.',
                    severity: 'medium',
                },
            ],
        });

        const report = parseNovelPolishCritiqueResponse(response);

        expect(report.issues).toHaveLength(2);
        expect(report.issues[0].category).toBe('ai_tic');
        expect(report.issues[0].severity).toBe('high');
        expect(report.issues[1].category).toBe('metaphor');
    });

    it('tolerates markdown fences around the JSON', () => {
        const response = [
            'Đây là output:',
            '```json',
            '{"issues":[{"category":"lexicon","quote":"tan biệt","reason":"Hán Việt bịa.","suggestion":"Dùng biến mất."}]}',
            '```',
        ].join('\n');

        const report = parseNovelPolishCritiqueResponse(response);

        expect(report.issues).toHaveLength(1);
        expect(report.issues[0].category).toBe('lexicon');
        expect(report.issues[0].quote).toBe('tan biệt');
    });

    it('drops issues with invalid category or empty quote', () => {
        const response = JSON.stringify({
            issues: [
                { category: 'not_a_real_class', quote: 'x', reason: 'y', suggestion: 'z' },
                { category: 'ai_tic', quote: '', reason: 'y', suggestion: 'z' },
                { category: 'ai_tic', quote: 'ok quote', reason: '', suggestion: 'z' },
                { category: 'consistency', quote: 'valid quote', reason: 'valid reason', suggestion: '' },
            ],
        });

        const report = parseNovelPolishCritiqueResponse(response);

        // Only the last one survives; missing suggestion is backfilled.
        expect(report.issues).toHaveLength(1);
        expect(report.issues[0].category).toBe('consistency');
        expect(report.issues[0].suggestion).toContain('editor không gợi ý');
    });

    it('returns empty issues when response is not valid JSON', () => {
        const report = parseNovelPolishCritiqueResponse('Xin lỗi, tôi không thể xử lý.');
        expect(report.issues).toEqual([]);
        expect(report.rawCriticResponse).toContain('Xin lỗi');
    });
});

describe('novel_polish_critique — quote verification', () => {
    it('drops issues whose quote cannot be found verbatim in the source', () => {
        const rawText = 'Hắn nhìn mặt biển. Sóng không gợn.';
        const issues: NovelPolishIssue[] = [
            { category: 'ai_tic', quote: 'Sóng không gợn.', reason: 'x', suggestion: 'y' },
            { category: 'metaphor', quote: 'mặt biển phẳng như gương', reason: 'x', suggestion: 'y' },
        ];

        const filtered = filterIssuesPresentInSource(issues, rawText);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].quote).toBe('Sóng không gợn.');
    });
});

describe('novel_polish_critique — Surgeon prompt', () => {
    it('renders issue list with category, quote, reason, suggestion', () => {
        const { system, user } = buildNovelPolishSurgeonPrompt({
            rawText: 'Hắn rút tay khỏi vạt áo, mười ngón chân bấm vào ván gỗ.',
            issues: [
                {
                    category: 'consistency',
                    quote: 'mười ngón chân bấm vào ván gỗ',
                    reason: 'Không có cầu nối với tay đang trong vạt áo.',
                    suggestion: 'Thêm 1 hành động trung gian hoặc bỏ chi tiết ngón chân.',
                    severity: 'high',
                },
            ],
        });

        expect(system).toContain('CHỈ sửa các câu được flag');
        expect(system).toContain('giữ nguyên TỪNG KÝ TỰ');
        expect(user).toContain('#1 [consistency]');
        expect(user).toContain('[high]');
        expect(user).toContain('mười ngón chân bấm vào ván gỗ');
        expect(user).toContain('VĂN BẢN GỐC');
    });

    it('falls back to a noop instruction when there are no issues', () => {
        const { user } = buildNovelPolishSurgeonPrompt({
            rawText: 'Văn bản sạch.',
            issues: [],
        });

        expect(user).toContain('không có issue');
    });
});

describe('novel_polish_critique — runNovelPolishCritique orchestration', () => {
    it('calls Critic then Surgeon, returning rewritten text when issues are found', async () => {
        const criticOutput = JSON.stringify({
            issues: [
                {
                    category: 'ai_tic',
                    quote: 'không gợn sóng, không tiếng gió, không cả tiếng thủy thủ',
                    reason: 'Tam đoạn phủ định lặp.',
                    suggestion: 'Chuyển thành 2 vế.',
                },
            ],
        });
        const surgeonOutput = 'Mặt biển lặng tờ, chỉ còn tiếng thủy thủ gọi nhau khe khẽ.';

        const runModel: RunModelFn = vi.fn(async ({ phase }) => {
            return phase === 'critic' ? criticOutput : surgeonOutput;
        });

        const result = await runNovelPolishCritique(
            {
                rawText:
                    'Đêm đó trên biển, không gợn sóng, không tiếng gió, không cả tiếng thủy thủ. Mọi thứ đứng yên.',
            },
            runModel,
        );

        expect(runModel).toHaveBeenCalledTimes(2);
        expect(runModel).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ phase: 'critic' }),
        );
        expect(runModel).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ phase: 'surgeon' }),
        );
        expect(result.issues).toHaveLength(1);
        expect(result.rewrittenText).toBe(surgeonOutput);
    });

    it('skips Surgeon call and returns the original text when Critic finds no valid issues', async () => {
        const runModel: RunModelFn = vi.fn(async () => '{"issues":[]}');

        const result = await runNovelPolishCritique(
            { rawText: 'Văn bản sạch.' },
            runModel,
        );

        expect(runModel).toHaveBeenCalledTimes(1);
        expect(result.rewrittenText).toBe('Văn bản sạch.');
        expect(result.issues).toEqual([]);
        expect(result.rawSurgeonResponse).toBe('');
    });

    it('skips Surgeon call when every critic quote fails source verification', async () => {
        const criticOutput = JSON.stringify({
            issues: [
                {
                    category: 'metaphor',
                    quote: 'một đoạn không tồn tại trong input',
                    reason: 'x',
                    suggestion: 'y',
                },
            ],
        });
        const runModel: RunModelFn = vi.fn(async () => criticOutput);

        const result = await runNovelPolishCritique(
            { rawText: 'Văn bản gốc.' },
            runModel,
        );

        expect(runModel).toHaveBeenCalledTimes(1);
        expect(result.issues).toEqual([]);
        expect(result.rewrittenText).toBe('Văn bản gốc.');
    });
});
