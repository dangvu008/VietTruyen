/**
 * File: fatigue_word_auditor.ts
 * Purpose: Audits AI text for repetitive "fatigue" words (P2b).
 * Layer: Infra -> Memory
 * Domain: NarrativeMemory
 */

const VI_FATIGUE_WORDS = [
  'ánh mắt sắc bén', 'ánh mắt lạnh lùng', 'tim đập mạnh',
  'thổn thức', 'rung động', 'bước chân vững chắc',
  'bầu không khí', 'hơi thở không đều', 'cảm giác mơ hồ',
  'trầm tư', 'đau lòng', 'nội tâm phức tạp',
  'mỉm cười', 'cười khổ', 'nhíu mày', 'ánh mắt phức tạp',
  'lắc đầu', 'thở dài', 'ánh mắt thâm thúy'
];

export interface FatigueAuditResult {
  hasFatigue: boolean;
  matches: Array<{ word: string; count: number; positions: number[] }>;
  score: number; // 0-100, >30 = needs review
}

export function auditFatigueWords(content: string): FatigueAuditResult {
  if (!content) return { hasFatigue: false, matches: [], score: 0 };
  
  const matches: FatigueAuditResult['matches'] = [];
  const lowerContent = content.toLowerCase();
  let totalScore = 0;

  for (const word of VI_FATIGUE_WORDS) {
    const wordLower = word.toLowerCase();
    let count = 0;
    const positions: number[] = [];
    let index = lowerContent.indexOf(wordLower);
    
    while (index !== -1) {
      count++;
      positions.push(index);
      index = lowerContent.indexOf(wordLower, index + wordLower.length);
    }

    if (count > 0) {
      matches.push({ word, count, positions });
      // Penalize heavily for repeated usage in the same chapter
      totalScore += count === 1 ? 5 : 5 + Math.pow(count, 1.5) * 5; 
    }
  }

  // Cap score at 100
  const normalizedScore = Math.min(100, Math.round(totalScore));

  return {
    hasFatigue: normalizedScore >= 30,
    matches: matches.sort((a, b) => b.count - a.count),
    score: normalizedScore,
  };
}
