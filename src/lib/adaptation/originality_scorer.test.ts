import { describe, expect, it } from 'vitest';
import {
    buildShingleSet,
    computeLexicalOverlap,
    computeStructuralSimilarity,
    findFlaggedPassages,
    jaccardSimilarity,
    scoreOriginality,
} from './originality_scorer';

describe('originality_scorer', () => {
    describe('buildShingleSet', () => {
        it('builds 4-gram shingles from text', () => {
            const text = 'một hai ba bốn năm sáu';
            const shingles = buildShingleSet(text, 4);
            expect(shingles.size).toBe(3); // "một hai ba bốn", "hai ba bốn năm", "ba bốn năm sáu"
        });

        it('returns empty set for short text', () => {
            const shingles = buildShingleSet('ngắn', 4);
            expect(shingles.size).toBe(0);
        });

        it('normalizes text before shingling', () => {
            const text1 = 'Xin Chào Thế Giới Mới';
            const text2 = 'xin chào thế giới mới';
            const s1 = buildShingleSet(text1, 4);
            const s2 = buildShingleSet(text2, 4);
            expect(s1.size).toBe(s2.size);
        });
    });

    describe('jaccardSimilarity', () => {
        it('returns 1 for identical sets', () => {
            const set = new Set(['a', 'b', 'c']);
            expect(jaccardSimilarity(set, set)).toBe(1);
        });

        it('returns 0 for disjoint sets', () => {
            const setA = new Set(['a', 'b']);
            const setB = new Set(['c', 'd']);
            expect(jaccardSimilarity(setA, setB)).toBe(0);
        });

        it('returns 0 for two empty sets', () => {
            expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
        });

        it('computes correct similarity for overlapping sets', () => {
            const setA = new Set(['a', 'b', 'c']);
            const setB = new Set(['b', 'c', 'd']);
            // intersection = 2, union = 4
            expect(jaccardSimilarity(setA, setB)).toBe(0.5);
        });
    });

    describe('computeLexicalOverlap', () => {
        it('returns high overlap for identical texts', () => {
            const text = 'Đây là một đoạn văn bản dài đủ để tạo shingles cho việc so sánh';
            const overlap = computeLexicalOverlap(text, text);
            expect(overlap).toBe(1);
        });

        it('returns low overlap for completely different texts', () => {
            const source = 'Trời xanh mây trắng gió nhẹ thổi qua cánh đồng lúa chín vàng';
            const output = 'Con mèo đen ngồi trên mái nhà nhìn xuống sân vườn đầy hoa';
            const overlap = computeLexicalOverlap(source, output);
            expect(overlap).toBeLessThan(0.3);
        });

        it('returns moderate overlap for paraphrased text', () => {
            const source = 'Anh ta bước vào phòng và nhìn quanh một lượt rồi ngồi xuống ghế';
            const output = 'Hắn bước vào căn phòng rồi đảo mắt nhìn quanh trước khi ngồi xuống';
            const overlap = computeLexicalOverlap(source, output);
            // Paraphrased should have some overlap but not too much
            expect(overlap).toBeLessThan(0.7);
        });
    });

    describe('computeStructuralSimilarity', () => {
        it('returns high similarity for texts with same structure', () => {
            const source = 'Câu một. Câu hai. Câu ba.\n\nĐoạn hai. Câu tiếp.';
            const output = 'Dòng A. Dòng B. Dòng C.\n\nPhần hai. Dòng nữa.';
            const sim = computeStructuralSimilarity(source, output);
            expect(sim).toBeGreaterThan(0.5);
        });

        it('returns lower similarity for different structures', () => {
            const source = 'Một câu rất dài không có dấu chấm nào cả cho đến tận cuối cùng.';
            const output = 'Ngắn. Gọn. Lẹ. Từng. Câu. Một.';
            const sim = computeStructuralSimilarity(source, output);
            expect(sim).toBeLessThan(0.8);
        });
    });

    describe('scoreOriginality', () => {
        it('gives pass verdict for completely different texts', () => {
            const source = 'Trong thế giới tu tiên có một thanh niên tên Lâm Phong tu luyện mỗi ngày không ngừng nghỉ';
            const output = 'Tại thành phố hiện đại có một cô gái tên Mai Anh làm việc tại công ty công nghệ hàng đầu';
            const report = scoreOriginality(source, output);
            expect(report.verdict).toBe('pass');
            expect(report.overallScore).toBeGreaterThan(50);
        });

        it('gives fail verdict for identical texts', () => {
            const text = 'Đoạn văn giống hệt nhau được copy nguyên xi không thay đổi gì cả trong bản mới';
            const report = scoreOriginality(text, text);
            expect(report.verdict).toBe('fail');
            expect(report.lexicalOverlap).toBe(1);
        });

        it('includes semantic distance in score', () => {
            const source = 'Nội dung gốc đây';
            const output = 'Nội dung mới hoàn toàn khác';
            const report = scoreOriginality(source, output, 0.8);
            expect(report.semanticDistance).toBe(0.8);
        });
    });

    describe('findFlaggedPassages', () => {
        it('returns empty for short texts', () => {
            const flags = findFlaggedPassages('ngắn', 'cũng ngắn');
            expect(flags).toHaveLength(0);
        });

        it('flags copied passages in longer texts', () => {
            // Create a long enough text with a copied section
            const sharedPassage = Array.from({ length: 60 }, (_, i) => `từ${i}`).join(' ');
            const source = `Phần đầu khác biệt hoàn toàn. ${sharedPassage} Phần cuối cũng khác.`;
            const output = `Mở đầu mới mẻ sáng tạo. ${sharedPassage} Kết thúc độc đáo.`;

            const flags = findFlaggedPassages(source, output);
            expect(flags.length).toBeGreaterThan(0);
            expect(flags[0].similarity).toBeGreaterThan(0.4);
        });
    });
});
