export interface EntropyChapterSample {
  chapterIndex: number;
  plotSignature?: string;
  proseSignature?: string;
  dialogueVoiceSignatures?: Record<string, string>;
  powerLevel?: number;
  unresolvedHookCount?: number;
}

export interface NarrativeEntropyIssue {
  type: 'plot_repetition' | 'prose_repetition' | 'voice_convergence' | 'power_creep' | 'hook_accumulation';
  severity: 'info' | 'warning' | 'critical';
  chapterIndex: number;
  message: string;
}

function normalized(value?: string): string {
  return (value || '').trim().toLowerCase();
}

export function auditNarrativeEntropy(samples: EntropyChapterSample[]): NarrativeEntropyIssue[] {
  const issues: NarrativeEntropyIssue[] = [];
  const sorted = [...samples].sort((a, b) => a.chapterIndex - b.chapterIndex);
  const recentPlots: string[] = [];
  const recentProse: string[] = [];

  for (const sample of sorted) {
    const plot = normalized(sample.plotSignature);
    if (plot && recentPlots.slice(-8).includes(plot)) {
      issues.push({ type: 'plot_repetition', severity: 'warning', chapterIndex: sample.chapterIndex, message: 'Plot signature repeats within the recent long-range window.' });
    }
    if (plot) recentPlots.push(plot);

    const prose = normalized(sample.proseSignature);
    if (prose && recentProse.slice(-8).includes(prose)) {
      issues.push({ type: 'prose_repetition', severity: 'warning', chapterIndex: sample.chapterIndex, message: 'Prose/rhythm signature repeats within the recent long-range window.' });
    }
    if (prose) recentProse.push(prose);

    const voices = Object.values(sample.dialogueVoiceSignatures || {}).map(normalized).filter(Boolean);
    if (voices.length >= 2 && new Set(voices).size === 1) {
      issues.push({ type: 'voice_convergence', severity: 'warning', chapterIndex: sample.chapterIndex, message: 'Multiple characters share the same dialogue voice signature.' });
    }

    const previous = sorted.find((item) => item.chapterIndex < sample.chapterIndex && item.powerLevel != null);
    if (sample.powerLevel != null && previous?.powerLevel != null && sample.powerLevel > previous.powerLevel * 2) {
      issues.push({ type: 'power_creep', severity: 'warning', chapterIndex: sample.chapterIndex, message: 'Power level jumps by more than 2x without an explicit audit exception.' });
    }

    if ((sample.unresolvedHookCount ?? 0) >= 20) {
      issues.push({ type: 'hook_accumulation', severity: 'critical', chapterIndex: sample.chapterIndex, message: 'Unresolved hook inventory is excessively high and needs consolidation/payoff review.' });
    }
  }

  return issues;
}
