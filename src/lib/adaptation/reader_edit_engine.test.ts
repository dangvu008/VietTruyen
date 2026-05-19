import { describe, expect, it } from 'vitest';
import {
    applyAllRenames,
    applyDetailChanges,
    applyReaderEdits,
    applySceneSkips,
    applySmartRename,
    createDetailChangeRule,
    createRenameRule,
    createSceneEditRule,
    createSceneSkipRule,
    createRelationshipRule,
    createToneShiftRule,
} from './reader_edit_engine';
import type { RenameConfig } from './reader_edit_engine';

describe('reader_edit_engine', () => {
    describe('applySmartRename', () => {
        it('replaces exact character name', () => {
            const text = 'Lâm Phong bước vào phòng. Lâm Phong nhìn quanh.';
            const config: RenameConfig = {
                type: 'rename',
                originalName: 'Lâm Phong',
                newName: 'Trần Hải',
                aliases: [],
                newAliases: [],
            };

            const result = applySmartRename(text, config);
            expect(result).toBe('Trần Hải bước vào phòng. Trần Hải nhìn quanh.');
        });

        it('replaces aliases alongside main name', () => {
            const text = 'Lâm Phong — hay còn gọi là Phong ca — đã đến. Phong ca cười.';
            const config: RenameConfig = {
                type: 'rename',
                originalName: 'Lâm Phong',
                newName: 'Trần Hải',
                aliases: ['Phong ca'],
                newAliases: ['Hải ca'],
            };

            const result = applySmartRename(text, config);
            expect(result).toContain('Trần Hải');
            expect(result).toContain('Hải ca');
            expect(result).not.toContain('Lâm Phong');
            expect(result).not.toContain('Phong ca');
        });

        it('handles empty aliases gracefully', () => {
            const text = 'Minh đi học.';
            const config: RenameConfig = {
                type: 'rename',
                originalName: 'Minh',
                newName: 'Tuấn',
                aliases: [],
                newAliases: [],
            };

            const result = applySmartRename(text, config);
            expect(result).toBe('Tuấn đi học.');
        });
    });

    describe('applyAllRenames', () => {
        it('applies multiple rename rules sorted by length', () => {
            const text = 'Lâm Phong và Tiểu Phong cùng đi.';
            const rules = [
                createRenameRule('Lâm Phong', 'Trần Hải'),
                createRenameRule('Tiểu Phong', 'Tiểu Hải'),
            ];

            const result = applyAllRenames(text, rules);
            expect(result).toContain('Trần Hải');
            expect(result).toContain('Tiểu Hải');
            expect(result).not.toContain('Phong');
        });

        it('skips disabled rules', () => {
            const text = 'Lâm Phong đi.';
            const rule = createRenameRule('Lâm Phong', 'Trần Hải');
            rule.enabled = false;

            const result = applyAllRenames(text, [rule]);
            expect(result).toBe('Lâm Phong đi.');
        });
    });

    describe('applyDetailChanges', () => {
        it('replaces detail in all occurrences', () => {
            const text = 'Kiếm dài ba thước. Thanh kiếm dài ba thước sáng lóa.';
            const rules = [createDetailChangeRule('dài ba thước', 'dài năm thước', 'all')];

            const result = applyDetailChanges(text, rules);
            expect(result).toBe('Kiếm dài năm thước. Thanh kiếm dài năm thước sáng lóa.');
        });

        it('replaces only first occurrence when scope is first', () => {
            const text = 'Mắt đỏ. Mắt đỏ rực.';
            const rules = [createDetailChangeRule('Mắt đỏ', 'Mắt xanh', 'first')];

            const result = applyDetailChanges(text, rules);
            expect(result).toBe('Mắt xanh. Mắt đỏ rực.');
        });
    });

    describe('applySceneSkips', () => {
        it('removes scene when exact text found', () => {
            const text = 'Đoạn 1. Đoạn cần bỏ. Đoạn 3.';
            const rules = [createSceneSkipRule('Đoạn cần bỏ.', 'remove')];

            const { text: result, aiNeeded } = applySceneSkips(text, rules);
            expect(result).toBe('Đoạn 1.  Đoạn 3.');
            expect(aiNeeded).toHaveLength(0);
        });

        it('replaces with custom text', () => {
            const text = 'Trước. Cảnh không thích. Sau.';
            const rules = [createSceneSkipRule('Cảnh không thích.', 'custom', '[Đã lược]')];

            const { text: result } = applySceneSkips(text, rules);
            expect(result).toContain('[Đã lược]');
            expect(result).not.toContain('Cảnh không thích');
        });

        it('returns aiNeeded when scene not found by exact text', () => {
            const text = 'Nội dung truyện bình thường.';
            const rules = [createSceneSkipRule('đoạn harem chương 5', 'remove')];

            const { aiNeeded } = applySceneSkips(text, rules);
            expect(aiNeeded).toHaveLength(1);
            expect(aiNeeded[0].sceneDescription).toBe('đoạn harem chương 5');
        });
    });

    describe('applyReaderEdits (full pipeline)', () => {
        it('applies rename + detail change together', () => {
            const text = 'Lâm Phong cầm kiếm dài ba thước.';
            const rules = [
                createRenameRule('Lâm Phong', 'Trần Hải'),
                createDetailChangeRule('kiếm dài ba thước', 'đao ngắn'),
            ];

            const result = applyReaderEdits(text, rules);
            expect(result.text).toBe('Trần Hải cầm đao ngắn.');
            expect(result.appliedCount).toBeGreaterThan(0);
        });

        it('collects AI-needed edits without modifying text', () => {
            const text = 'Nội dung gốc.';
            const rules = [
                createSceneEditRule('đoạn đầu', 'làm hài hước hơn'),
                createToneShiftRule('toàn chương', 'nhẹ nhàng hơn'),
            ];

            const result = applyReaderEdits(text, rules);
            expect(result.text).toBe('Nội dung gốc.');
            expect(result.aiNeededEdits).toHaveLength(2);
        });

        it('respects chapter filter', () => {
            const text = 'Lâm Phong đi.';
            const rule = createRenameRule('Lâm Phong', 'Trần Hải');
            rule.applyToChapters = [5, 6, 7];

            // Chapter 3 — rule should NOT apply
            const result = applyReaderEdits(text, [rule], 3);
            expect(result.text).toBe('Lâm Phong đi.');

            // Chapter 5 — rule SHOULD apply
            const result2 = applyReaderEdits(text, [rule], 5);
            expect(result2.text).toBe('Trần Hải đi.');
        });
    });

    describe('rule builders', () => {
        it('createRenameRule builds valid rule', () => {
            const rule = createRenameRule('A', 'B', { aliases: ['a1'], newAliases: ['b1'] });
            expect(rule.type).toBe('rename');
            expect(rule.enabled).toBe(true);
            expect(rule.config.type).toBe('rename');
        });

        it('createRelationshipRule builds valid rule', () => {
            const rule = createRelationshipRule('A', 'B', 'người yêu', 'bạn thân', 'behavioral');
            expect(rule.type).toBe('relationship');
            expect((rule.config as any).depth).toBe('behavioral');
        });
    });
});
