/**
 * File: originality_scorer.ts
 * Purpose: Đo độ khác biệt giữa output và source — gate trước khi publish
 * Layer: Application
 * Domain: Adaptation → [hybrid, originality verification]
 *
 * Metrics:
 * - Lexical overlap: n-gram shingling (chạy local, không cần AI)
 * - Structural similarity: so sánh sentence count, paragraph structure
 * - Semantic distance: cosine distance qua embeddings (optional, cần vector infra)
 */

import type { OriginalityFlaggedPassage, OriginalityReport, OriginalityVerdict } from '../../types/adaptation';

// ─── Constants ──────────────────────────────────────────────

const NGRAM_SIZE = 4;
const LEXICAL_PASS_THRESHOLD = 0.15;
const LEXICAL_REVIEW_THRESHOLD = 0.30;
const SEMANTIC_PASS_THRESHOLD = 0.6;
const SEMANTIC_REVIEW_THRESHOLD = 0.4;
const FLAGGED_SIMILARITY_THRESHOLD = 0.5;

// ─── N-gram Shingling ───────────────────────────────────────

/**
 * Tạo set of n-grams (shingles) từ text.
 * Normalize: lowercase, remove punctuation, collapse whitespace.
 */
export function buildShingleSet(text: string, n: number = NGRAM_SIZE): Set<string> {
    const normalized = normalizeForComparison(text);
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    const shingles = new Set<string>();

    for (let i = 0; i <= words.length - n; i++) {
        shingles.add(words.slice(i, i + n).join(' '));
    }

    return shingles;
}

/**
 * Tính Jaccard similarity giữa 2 shingle sets.
 * Returns 0-1 (0 = hoàn toàn khác, 1 = giống hệt).
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 0;

    let intersection = 0;
    const smaller = setA.size <= setB.size ? setA : setB;
    const larger = setA.size <= setB.size ? setB : setA;

    smaller.forEach((item) => {
        if (larger.has(item)) intersection++;
    });

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Tính lexical overlap giữa source và output.
 * Dùng 4-gram shingling + Jaccard similarity.
 */
export function computeLexicalOverlap(sourceText: string, outputText: string): number {
    const sourceShingles = buildShingleSet(sourceText);
    const outputShingles = buildShingleSet(outputText);
    return jaccardSimilarity(sourceShingles, outputShingles);
}

// ─── Structural Similarity ──────────────────────────────────

/**
 * So sánh cấu trúc văn bản: số câu, độ dài trung bình, tỷ lệ dialogue.
 * Returns 0-1 (0 = cấu trúc hoàn toàn khác, 1 = giống hệt).
 */
export function computeStructuralSimilarity(sourceText: string, outputText: string): number {
    const sourceStats = computeTextStats(sourceText);
    const outputStats = computeTextStats(outputText);

    // Compare multiple structural features
    const features = [
        similarityRatio(sourceStats.sentenceCount, outputStats.sentenceCount),
        similarityRatio(sourceStats.avgSentenceLength, outputStats.avgSentenceLength),
        similarityRatio(sourceStats.paragraphCount, outputStats.paragraphCount),
        Math.abs(sourceStats.dialogueRatio - outputStats.dialogueRatio) < 0.2 ? 0.8 : 0.3,
    ];

    return features.reduce((sum, f) => sum + f, 0) / features.length;
}

interface TextStats {
    sentenceCount: number;
    avgSentenceLength: number;
    paragraphCount: number;
    dialogueRatio: number;
}

function computeTextStats(text: string): TextStats {
    const sentences = text.split(/[.!?。！？]+/).filter((s) => s.trim().length > 5);
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    const dialogueLines = text.split('\n').filter(
        (l) => l.trim().startsWith('"') || l.trim().startsWith('"') || l.trim().startsWith('—') || l.trim().startsWith('-'),
    );
    const totalLines = text.split('\n').filter((l) => l.trim().length > 0);

    return {
        sentenceCount: sentences.length,
        avgSentenceLength: sentences.length > 0
            ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
            : 0,
        paragraphCount: paragraphs.length,
        dialogueRatio: totalLines.length > 0 ? dialogueLines.length / totalLines.length : 0,
    };
}

function similarityRatio(a: number, b: number): number {
    if (a === 0 && b === 0) return 1;
    const max = Math.max(a, b);
    const min = Math.min(a, b);
    return max === 0 ? 0 : min / max;
}

// ─── Passage-Level Flagging ─────────────────────────────────

/**
 * Tìm các đoạn trong output quá giống source (potential copy).
 * Dùng sliding window comparison.
 */
export function findFlaggedPassages(
    sourceText: string,
    outputText: string,
    windowSize: number = 50,
): OriginalityFlaggedPassage[] {
    const flagged: OriginalityFlaggedPassage[] = [];
    const sourceWords = normalizeForComparison(sourceText).split(/\s+/);
    const outputWords = normalizeForComparison(outputText).split(/\s+/);

    if (outputWords.length < windowSize || sourceWords.length < windowSize) {
        return flagged;
    }

    // Build source shingle index for fast lookup
    const sourceWindowShingles = new Map<string, number>();
    for (let i = 0; i <= sourceWords.length - windowSize; i += 10) {
        const window = sourceWords.slice(i, i + windowSize).join(' ');
        sourceWindowShingles.set(window, i);
    }

    // Slide through output and check against source
    for (let i = 0; i <= outputWords.length - windowSize; i += 10) {
        const outputWindow = outputWords.slice(i, i + windowSize);
        const outputWindowStr = outputWindow.join(' ');

        // Check exact match first
        if (sourceWindowShingles.has(outputWindowStr)) {
            const sourceIdx = sourceWindowShingles.get(outputWindowStr)!;
            flagged.push({
                outputSpan: outputWindow.join(' ').slice(0, 200),
                sourceSpan: sourceWords.slice(sourceIdx, sourceIdx + windowSize).join(' ').slice(0, 200),
                similarity: 1.0,
            });
            continue;
        }

        // Check high similarity with smaller n-grams
        const outputShingles = new Set(
            Array.from({ length: outputWindow.length - 3 }, (_, j) =>
                outputWindow.slice(j, j + 4).join(' '),
            ),
        );

        // Sample source windows for comparison (performance optimization)
        for (let j = 0; j <= sourceWords.length - windowSize; j += 30) {
            const sourceWindow = sourceWords.slice(j, j + windowSize);
            const sourceShingles = new Set(
                Array.from({ length: sourceWindow.length - 3 }, (_, k) =>
                    sourceWindow.slice(k, k + 4).join(' '),
                ),
            );

            const sim = jaccardSimilarity(outputShingles, sourceShingles);
            if (sim > FLAGGED_SIMILARITY_THRESHOLD) {
                flagged.push({
                    outputSpan: outputWindow.join(' ').slice(0, 200),
                    sourceSpan: sourceWindow.join(' ').slice(0, 200),
                    similarity: sim,
                });
                break; // One flag per output window is enough
            }
        }
    }

    // Deduplicate overlapping flags
    return deduplicateFlags(flagged);
}

function deduplicateFlags(flags: OriginalityFlaggedPassage[]): OriginalityFlaggedPassage[] {
    if (flags.length <= 1) return flags;

    const sorted = [...flags].sort((a, b) => b.similarity - a.similarity);
    const result: OriginalityFlaggedPassage[] = [];
    const seen = new Set<string>();

    for (const flag of sorted) {
        const key = flag.outputSpan.slice(0, 50);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(flag);
        }
    }

    return result.slice(0, 20); // Max 20 flags
}

// ─── Full Originality Report ────────────────────────────────

/**
 * Chạy full originality check giữa source và output.
 * Không cần AI — chạy hoàn toàn local.
 *
 * @param semanticDistance - Optional, nếu có embedding infrastructure.
 *   Caller tính cosine distance giữa source/output embeddings rồi pass vào.
 */
export function scoreOriginality(
    sourceText: string,
    outputText: string,
    semanticDistance?: number,
): OriginalityReport {
    const lexicalOverlap = computeLexicalOverlap(sourceText, outputText);
    const structuralSimilarity = computeStructuralSimilarity(sourceText, outputText);
    const flaggedPassages = findFlaggedPassages(sourceText, outputText);

    // Use provided semantic distance or estimate from lexical
    const effectiveSemanticDistance = semanticDistance ?? estimateSemanticFromLexical(lexicalOverlap);

    // Compute overall score (0-100, higher = more original)
    const overallScore = computeOverallScore(lexicalOverlap, structuralSimilarity, effectiveSemanticDistance);

    // Determine verdict
    const verdict = determineVerdict(lexicalOverlap, effectiveSemanticDistance);

    return {
        overallScore,
        lexicalOverlap,
        structuralSimilarity,
        semanticDistance: effectiveSemanticDistance,
        flaggedPassages,
        verdict,
    };
}

/**
 * Score originality cho từng chapter (dùng trong progressive rewrite view).
 */
export function scoreChapterOriginality(
    sourceChapterText: string,
    outputChapterText: string,
    semanticDistance?: number,
): OriginalityReport {
    return scoreOriginality(sourceChapterText, outputChapterText, semanticDistance);
}

function computeOverallScore(
    lexicalOverlap: number,
    structuralSimilarity: number,
    semanticDistance: number,
): number {
    // Weighted formula: lexical matters most, then semantic, then structural
    const lexicalScore = (1 - lexicalOverlap) * 100;
    const semanticScore = semanticDistance * 100;
    const structuralScore = (1 - structuralSimilarity) * 100;

    const weighted = lexicalScore * 0.5 + semanticScore * 0.35 + structuralScore * 0.15;
    return Math.round(Math.max(0, Math.min(100, weighted)));
}

function determineVerdict(lexicalOverlap: number, semanticDistance: number): OriginalityVerdict {
    if (lexicalOverlap > LEXICAL_REVIEW_THRESHOLD || semanticDistance < SEMANTIC_REVIEW_THRESHOLD) {
        return 'fail';
    }
    if (lexicalOverlap > LEXICAL_PASS_THRESHOLD || semanticDistance < SEMANTIC_PASS_THRESHOLD) {
        return 'review';
    }
    return 'pass';
}

function estimateSemanticFromLexical(lexicalOverlap: number): number {
    // Rough estimate: high lexical overlap → low semantic distance
    // This is a fallback when embeddings aren't available
    return Math.max(0, Math.min(1, 1 - lexicalOverlap * 1.2));
}

// ─── Utilities ──────────────────────────────────────────────

function normalizeForComparison(text: string): string {
    return text
        .toLowerCase()
        .replace(/[""''「」『』【】]/g, '"')
        .replace(/[—–]/g, '-')
        // Remove punctuation but keep letters (including Vietnamese), numbers, spaces
        .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
