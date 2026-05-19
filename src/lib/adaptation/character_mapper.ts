/**
 * File: character_mapper.ts
 * Purpose: Mapping nhân vật source → target với trait deltas cho hybrid adaptation
 * Layer: Application
 * Domain: Adaptation → [hybrid, character mapping]
 */

import type { Character } from '../../types/story';
import type {
    CharacterMapping,
    CharacterMappingTable,
    CharacterRelationshipChange,
} from '../../types/adaptation';
import type { EntityDefinition } from '../../types/narrative_memory';

// ─── Character Detection from Source ────────────────────────

export interface DetectedCharacter {
    entityId: string;
    name: string;
    mentionCount: number;
    firstAppearance: number;
    traits: string[];
    relationships: string[];
}

/**
 * Detect nhân vật từ entity definitions đã extract (sau khi chạy memory_sync_bridge).
 * Sắp xếp theo confidence để user biết nhân vật nào quan trọng.
 */
export function detectCharactersFromEntities(
    entities: EntityDefinition[],
): DetectedCharacter[] {
    return entities
        .filter((e) => e.entityType === 'character')
        .map((entity) => ({
            entityId: entity.entityId,
            name: entity.canonicalName,
            mentionCount: Math.round(entity.confidence * 10),
            firstAppearance: 0,
            traits: extractTraitsFromAttributes(entity.attributes),
            relationships: extractRelationshipsFromAttributes(entity.attributes),
        }))
        .sort((a, b) => b.mentionCount - a.mentionCount);
}

/**
 * Detect nhân vật từ project characters array (fallback khi chưa có entity defs).
 */
export function detectCharactersFromProject(characters: Character[]): DetectedCharacter[] {
    return characters.map((char) => ({
        entityId: char.id || char.name,
        name: char.name,
        mentionCount: 0,
        firstAppearance: 0,
        traits: [
            char.traits || '',
            char.role || '',
            char.arc || '',
        ].filter(Boolean),
        relationships: [],
    }));
}

function extractTraitsFromAttributes(
    attributes: Record<string, string> | undefined,
): string[] {
    if (!attributes) return [];
    const traits: string[] = [];

    const traitKeys = ['personality', 'appearance', 'background', 'motivation', 'weakness'];
    for (const key of traitKeys) {
        const val = attributes[key];
        if (val && val.trim()) {
            traits.push(`${key}: ${val.trim()}`);
        }
    }

    return traits;
}

function extractRelationshipsFromAttributes(
    attributes: Record<string, string> | undefined,
): string[] {
    if (!attributes) return [];
    const rels = attributes['relationships'];
    if (rels && rels.trim()) {
        return rels.split(',').map((r) => r.trim()).filter(Boolean).slice(0, 10);
    }
    return [];
}

// ─── Mapping Creation & Validation ──────────────────────────

/**
 * Tạo mapping table mặc định — tất cả nhân vật chưa map, chờ user config.
 */
export function createEmptyMappingTable(
    detected: DetectedCharacter[],
): CharacterMappingTable {
    return {
        mappings: detected.map((char) => ({
            sourceEntityId: char.entityId,
            sourceName: char.name,
            targetName: '',
            targetBackground: '',
            personalityDelta: '',
        })),
        unmappedStrategy: 'auto_generate',
    };
}

/**
 * Tạo mapping từ user input. Validate completeness.
 */
export function buildCharacterMapping(
    sourceEntityId: string,
    sourceName: string,
    target: {
        name: string;
        gender?: string;
        background: string;
        personalityDelta: string;
        speechStyle?: string;
        relationshipChanges?: CharacterRelationshipChange[];
    },
): CharacterMapping {
    return {
        sourceEntityId,
        sourceName,
        targetName: target.name.trim(),
        targetGender: target.gender,
        targetBackground: target.background.trim(),
        personalityDelta: target.personalityDelta.trim(),
        speechStyle: target.speechStyle?.trim(),
        relationshipChanges: target.relationshipChanges,
    };
}

// ─── Validation ─────────────────────────────────────────────

export interface MappingValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    completeness: number; // 0-1, tỷ lệ nhân vật đã map
}

/**
 * Validate mapping table trước khi chạy rewrite.
 * - Tất cả nhân vật chính (top 3 by mention) phải được map
 * - Không có tên trùng nhau trong target
 * - Mỗi mapping phải có ít nhất targetName
 */
export function validateMappingTable(
    table: CharacterMappingTable,
    detected: DetectedCharacter[],
): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check completeness
    const mapped = table.mappings.filter((m) => m.targetName.trim().length > 0);
    const completeness = table.mappings.length > 0
        ? mapped.length / table.mappings.length
        : 0;

    // Top characters must be mapped
    const topCharacters = detected.slice(0, 3);
    for (const topChar of topCharacters) {
        const mapping = table.mappings.find((m) => m.sourceEntityId === topChar.entityId);
        if (!mapping || !mapping.targetName.trim()) {
            errors.push(`Nhân vật chính "${topChar.name}" chưa được map — bắt buộc.`);
        }
    }

    // Check duplicate target names
    const targetNames = mapped.map((m) => m.targetName.toLowerCase().trim());
    const duplicates = targetNames.filter((name, idx) => targetNames.indexOf(name) !== idx);
    if (duplicates.length > 0) {
        errors.push(`Tên nhân vật mới bị trùng: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    // Check source name === target name (no change)
    for (const mapping of mapped) {
        if (mapping.sourceName.toLowerCase() === mapping.targetName.toLowerCase()) {
            warnings.push(`"${mapping.sourceName}" giữ nguyên tên — nên đổi để tạo khác biệt.`);
        }
    }

    // Check empty backgrounds for main characters
    for (const mapping of mapped) {
        const isMain = topCharacters.some((c) => c.entityId === mapping.sourceEntityId);
        if (isMain && !mapping.targetBackground.trim()) {
            warnings.push(`"${mapping.targetName}" chưa có background mới — AI sẽ tự tạo.`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        completeness,
    };
}

// ─── Prompt Building ────────────────────────────────────────

/**
 * Build character mapping section cho rewrite prompt.
 * Đây là phần inject vào system prompt khi AI viết lại chapter.
 */
export function buildCharacterMapPromptSection(table: CharacterMappingTable): string {
    const mapped = table.mappings.filter((m) => m.targetName.trim());

    if (mapped.length === 0) return '';

    const lines = ['## BẢNG ĐỔI NHÂN VẬT', ''];

    for (const m of mapped) {
        lines.push(`### ${m.sourceName} → ${m.targetName}`);
        if (m.targetGender) lines.push(`- Giới tính: ${m.targetGender}`);
        if (m.targetBackground) lines.push(`- Background: ${m.targetBackground}`);
        if (m.personalityDelta) lines.push(`- Tính cách thay đổi: ${m.personalityDelta}`);
        if (m.speechStyle) lines.push(`- Cách nói chuyện: ${m.speechStyle}`);
        if (m.relationshipChanges && m.relationshipChanges.length > 0) {
            lines.push('- Quan hệ thay đổi:');
            for (const rc of m.relationshipChanges) {
                lines.push(`  - Với ${rc.withCharacterId}: ${rc.originalRelation} → ${rc.newRelation}`);
            }
        }
        lines.push('');
    }

    if (table.unmappedStrategy === 'remove') {
        lines.push('Nhân vật không có trong bảng trên: BỎ QUA, không xuất hiện trong bản mới.');
    } else if (table.unmappedStrategy === 'auto_generate') {
        lines.push('Nhân vật không có trong bảng trên: tự đặt tên mới phù hợp bối cảnh.');
    } else {
        lines.push('Nhân vật không có trong bảng trên: giữ nguyên vai trò, đổi tên generic.');
    }

    return lines.join('\n');
}
