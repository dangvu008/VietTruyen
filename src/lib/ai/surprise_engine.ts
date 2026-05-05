import type { OutlineBeat, Project } from '../../types/story';
import type {
  Anchor,
  AnchorSet,
  ChapterLedger,
  DivergenceIssue,
  DivergenceReport,
  ExpectationProfile,
  SurpriseBranch,
  TensionLevel,
} from '../../types/surprise';
import type { PendingHook } from '../../types/narrative_memory';
import { sortChaptersBySequence } from '../memory/chapter_order';

const STOP_WORDS = new Set([
  'va', 'và', 'cua', 'của', 'cho', 'voi', 'với', 'nhung', 'những', 'mot', 'một',
  'cac', 'các', 'khi', 'thi', 'thì', 'la', 'là', 'da', 'đã', 'dang', 'đang',
  'se', 'sẽ', 'tu', 'từ', 'trong', 'ngoai', 'ngoài', 'tren', 'trên', 'duoi', 'dưới',
  'tai', 'tại', 'sau', 'truoc', 'trước', 'voi', 'vi', 'vì', 'den', 'đến', 'theo',
  'nhu', 'như', 'cung', 'cùng', 'duoc', 'được', 'phai', 'phải', 'khong', 'không',
  'noi', 'nói', 'chuyen', 'chuyện', 'nhan', 'nhân', 'vat', 'vật', 'he', 'hệ',
  'thong', 'thống', 'the', 'thể', 'loai', 'loại',
]);

const NEGATION_TOKENS = ['khong', 'không', 'chua', 'chưa', 'cam', 'cấm', 'khong-duoc', 'không-được'];

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeStoryText(text: string): string {
  return collapseWhitespace(
    text
      .toLowerCase()
      .replace(/[“”"'"'`]/g, '')
      .replace(/[.,!?;:()[\]{}]/g, ' ')
  );
}

function slugify(text: string): string {
  return normalizeStoryText(text)
    .replace(/[^a-z0-9\u00C0-\u1EF9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'anchor';
}

function meaningfulTokens(text: string): string[] {
  return normalizeStoryText(text)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;,\n]+/)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length >= 8);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = normalizeStoryText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(collapseWhitespace(value));
  }
  return result;
}

export function getChaptersChronological(project: Project) {
  return sortChaptersBySequence(project.chapters || []);
}

function getRecentChapterTexts(project: Project, targetChapterIndex: number): string[] {
  const chapters = getChaptersChronological(project);
  const end = Math.min(targetChapterIndex, chapters.length);
  const recent = chapters.slice(Math.max(0, end - 3), end);
  return recent.flatMap((chapter) => {
    const values = [chapter.summary || '', chapter.content.slice(-500)];
    return values.filter(Boolean);
  });
}

function addAnchor(
  bucket: Anchor[],
  dedupe: Map<string, Anchor>,
  params: Omit<Anchor, 'id'>,
) {
  const key = `${params.kind}:${normalizeStoryText(params.label)}:${normalizeStoryText(params.detail)}`;
  if (dedupe.has(key)) return;
  const anchor: Anchor = {
    ...params,
    id: `${params.kind}:${params.weight}:${slugify(`${params.label}-${params.detail}`)}`,
  };
  dedupe.set(key, anchor);
  bucket.push(anchor);
}

function collectRepeatedClues(texts: string[]): string[] {
  const phraseCounts = new Map<string, number>();
  for (const text of texts) {
    for (const clause of splitClauses(text)) {
      const normalized = normalizeStoryText(clause);
      if (normalized.length < 12 || normalized.length > 80) continue;
      const tokens = meaningfulTokens(normalized);
      if (tokens.length < 2) continue;
      phraseCounts.set(normalized, (phraseCounts.get(normalized) ?? 0) + 1);
    }
  }

  return [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([phrase]) => collapseWhitespace(phrase))
    .slice(0, 5);
}

export function extractAnchors(project: Project, targetChapterIndex: number, pendingHooks: PendingHook[] = []): AnchorSet {
  const endgame: Anchor[] = [];
  const characterTruth: Anchor[] = [];
  const establishedFact: Anchor[] = [];
  const foreshadowingPlanted: Anchor[] = [];
  const dedupe = new Map<string, Anchor>();

  if (project.endgame) {
    addAnchor(endgame, dedupe, {
      kind: 'endgame',
      label: 'Endgame',
      detail: project.endgame,
      source: 'project.endgame',
      weight: 3,
    });
  }

  if (project.mainPlot) {
    addAnchor(endgame, dedupe, {
      kind: 'endgame',
      label: 'Main plot objective',
      detail: project.mainPlot,
      source: 'project.mainPlot',
      weight: 3,
    });
  }

  project.outline.slice(-3).forEach((beat, index) => {
    addAnchor(endgame, dedupe, {
      kind: 'endgame',
      label: beat.title || `Beat cuối ${index + 1}`,
      detail: beat.summary,
      source: `outline.tail.${index}`,
      weight: 3,
    });
  });

  project.characters.forEach((character) => {
    const fields: Array<[string, string | undefined]> = [
      ['role', character.role],
      ['traits', character.traits],
      ['arc', character.arc],
      ['stage', character.currentStage],
    ];

    fields.forEach(([label, value]) => {
      splitClauses(value || '')
        .slice(0, 2)
        .forEach((detail, index) => {
          addAnchor(characterTruth, dedupe, {
            kind: 'character_truth',
            label: `${character.name} ${label} ${index + 1}`,
            detail,
            source: `character.${character.id}.${label}`,
            weight: 2,
          });
        });
    });

    (character.facts || []).forEach((fact) => {
      addAnchor(establishedFact, dedupe, {
        kind: 'established_fact',
        label: `${character.name} fact ${fact.key}`,
        detail: `${fact.key}: ${fact.value}`,
        source: `character.${character.id}.facts.${fact.id}`,
        weight: 2,
      });
    });
  });

  const worldFields: Array<[string, string, 1 | 2 | 3]> = [
    ['geography', project.world.geography, 2],
    ['magicSystem', project.world.magicSystem, 3],
    ['techLevel', project.world.techLevel, 2],
    ['currency', project.world.currency, 3],
    ['rules', project.world.rules, 3],
  ];

  worldFields.forEach(([label, value, weight]) => {
    if (!value) return;
    addAnchor(establishedFact, dedupe, {
      kind: 'established_fact',
      label: `world ${label}`,
      detail: value,
      source: `world.${label}`,
      weight,
    });
  });

  project.world.factions.forEach((faction, index) => {
    addAnchor(establishedFact, dedupe, {
      kind: 'established_fact',
      label: `faction ${index + 1}`,
      detail: faction,
      source: `world.factions.${index}`,
      weight: 3,
    });
  });

  (project.world.facts || []).forEach((fact) => {
    addAnchor(establishedFact, dedupe, {
      kind: 'established_fact',
      label: `world fact ${fact.key}`,
      detail: `${fact.key}: ${fact.value}`,
      source: `world.facts.${fact.id}`,
      weight: 2,
    });
  });

  const recentChapters = getChaptersChronological(project).slice(
    Math.max(0, targetChapterIndex - 3),
    targetChapterIndex,
  );
  recentChapters.forEach((chapter, index) => {
    const summary = chapter.summary || chapter.content.slice(0, 220);
    if (!summary) return;
    const chapterTokens = meaningfulTokens(summary);
    const mentionsKnownEntity = project.characters.some((character) =>
      chapterTokens.some((token) => normalizeStoryText(character.name).includes(token))
    ) || project.world.factions.some((faction) =>
      chapterTokens.some((token) => normalizeStoryText(faction).includes(token))
    );
    if (!mentionsKnownEntity) return;
    addAnchor(establishedFact, dedupe, {
      kind: 'established_fact',
      label: `recent chapter ${index + 1}`,
      detail: summary,
      source: `chapter.${chapter.id}.summary`,
      weight: 1,
    });
  });

  (project.foreshadowings || [])
    .filter((foreshadow) => !foreshadow.isResolved)
    .forEach((foreshadow) => {
      addAnchor(foreshadowingPlanted, dedupe, {
        kind: 'foreshadowing_planted',
        label: 'Foreshadowing',
        detail: foreshadow.description,
        source: `foreshadowing.${foreshadow.id}`,
        weight: 2,
      });
    });

  pendingHooks
    .filter((hook) => hook.status === 'open')
    .forEach((hook) => {
      addAnchor(foreshadowingPlanted, dedupe, {
        kind: 'foreshadowing_planted',
        label: 'Pending Hook',
        detail: hook.description,
        source: `pendingHooks.${hook.id}`,
        weight: 2,
      });
    });

  collectRepeatedClues(getRecentChapterTexts(project, targetChapterIndex)).forEach((clue, index) => {
    addAnchor(foreshadowingPlanted, dedupe, {
      kind: 'foreshadowing_planted',
      label: `Repeated clue ${index + 1}`,
      detail: clue,
      source: 'chapters.repeated_clue',
      weight: 2,
    });
  });

  const all = [...endgame, ...characterTruth, ...establishedFact, ...foreshadowingPlanted];
  return { endgame, characterTruth, establishedFact, foreshadowingPlanted, all };
}

function buildExpectationCandidates(project: Project, targetChapterIndex: number, pendingHooks: PendingHook[] = []) {
  const candidates: Array<{ text: string; score: number; signal: string }> = [];
  const currentBeat = project.outline[targetChapterIndex];
  if (currentBeat?.summary) {
    candidates.push({
      text: currentBeat.summary,
      score: 45 + (currentBeat.focus ? 10 : 0),
      signal: `Beat hiện tại: ${currentBeat.title}`,
    });
  }

  const recentLegacyForeshadow = (project.foreshadowings || [])
    .filter((item) => !item.isResolved)
    .map(f => f.description);
    
  const recentPendingHooks = pendingHooks
    .filter(h => h.status === 'open')
    .map(h => h.description);

  const activeForeshadows = dedupeStrings([...recentLegacyForeshadow, ...recentPendingHooks]).slice(-2);
  
  activeForeshadows.forEach((desc, index) => {
    candidates.push({
      text: desc,
      score: 30 - index * 5,
      signal: `Phục bút chưa giải quyết: ${desc}`,
    });
  });

  const previousChapter = getChaptersChronological(project)[targetChapterIndex - 1];
  if (previousChapter?.content) {
    const tail = collapseWhitespace(previousChapter.content.slice(-450));
    candidates.push({
      text: tail,
      score: 25,
      signal: `Đoạn cuối chương trước: ${tail.slice(0, 120)}${tail.length > 120 ? '…' : ''}`,
    });
  }

  if (currentBeat?.focus) {
    candidates.push({
      text: currentBeat.focus,
      score: 20,
      signal: `Nhân vật trọng tâm của beat: ${currentBeat.focus}`,
    });
  }

  if (!currentBeat && project.mainPlot) {
    candidates.push({
      text: project.mainPlot,
      score: 20,
      signal: 'Mục tiêu gần nhất lấy từ mainPlot',
    });
  }

  if (!currentBeat && project.endgame) {
    candidates.push({
      text: project.endgame,
      score: 15,
      signal: 'Fallback endgame',
    });
  }

  return candidates.filter((candidate) => collapseWhitespace(candidate.text).length > 0);
}

export function detectExpectation(
  project: Project,
  targetChapterIndex: number,
  anchors: AnchorSet,
  pendingHooks: PendingHook[] = []
): ExpectationProfile {
  const candidates = buildExpectationCandidates(project, targetChapterIndex, pendingHooks);
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const dominant = ranked[0]?.text || anchors.endgame[0]?.detail || project.mainPlot || project.endgame || 'Giữ đà truyện tiến về đích gần nhất.';
  const totalSignalScore = ranked.slice(0, 5).reduce((sum, item) => sum + item.score, 0);
  const dominantShare = ranked[0] ? Math.round((ranked[0].score / Math.max(totalSignalScore, ranked[0].score)) * 100) : 0;

  return {
    dominantExpectation: collapseWhitespace(dominant),
    alternativeExpectations: dedupeStrings(ranked.slice(1, 4).map((item) => item.text)),
    setupSignals: dedupeStrings(ranked.slice(0, 5).map((item) => item.signal)),
    confidence: Math.min(100, Math.max(25, dominantShare + Math.min(30, ranked.length * 8))),
  };
}

function weightFromAnchorId(anchorId: string): number {
  const parts = anchorId.split(':');
  const maybeWeight = Number(parts[1]);
  return Number.isFinite(maybeWeight) && maybeWeight >= 1 && maybeWeight <= 3 ? maybeWeight : 1;
}

function keywordOverlapScore(a: string, b: string): number {
  const left = new Set(meaningfulTokens(a));
  const right = new Set(meaningfulTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap++;
  });
  return Math.round((overlap / Math.max(left.size, right.size)) * 100);
}

export function pickBestBranch(
  branches: SurpriseBranch[],
  tensionLevel: TensionLevel,
  expectation: ExpectationProfile,
  currentBeat?: OutlineBeat,
): { recommendedBranchId: string; scoredBranches: SurpriseBranch[] } {
  const weights: Record<TensionLevel, { preserve: number; beat: number; novelty: number; clue: number; impact: number; risk: number }> = {
    follow: { preserve: 35, beat: 35, novelty: 10, clue: 10, impact: 10, risk: 10 },
    nudge: { preserve: 30, beat: 20, novelty: 25, clue: 10, impact: 15, risk: 10 },
    twist: { preserve: 25, beat: 10, novelty: 30, clue: 15, impact: 20, risk: 10 },
    subvert: { preserve: 30, beat: 5, novelty: 25, clue: 20, impact: 20, risk: 10 },
  };

  const beatFit = (branch: SurpriseBranch) => {
    if (tensionLevel === 'follow' || tensionLevel === 'nudge') {
      if (branch.beatStrategy === 'follow') return 100;
      if (branch.beatStrategy === 'delay') return 70;
      return 40;
    }
    if (branch.beatStrategy === 'replace') return 100;
    if (branch.beatStrategy === 'delay') return 85;
    return currentBeat ? 50 : 60;
  };

  const scoredBranches = [...branches]
    .map((branch) => {
      const preserveWeight = branch.preservedAnchorIds.reduce((sum, anchorId) => sum + weightFromAnchorId(anchorId), 0);
      const preserveScore = Math.min(100, Math.round((preserveWeight / Math.max(6, branch.preservedAnchorIds.length * 3 || 6)) * 100));
      const noveltyScore = 100 - keywordOverlapScore(branch.summary, expectation.dominantExpectation);
      const clueScore = Math.min(100, branch.foreshadowNow.length * 35);
      const impactScore = Math.min(100, branch.impactTrace.length * 25);
      const score =
        (preserveScore * weights[tensionLevel].preserve) / 100 +
        (beatFit(branch) * weights[tensionLevel].beat) / 100 +
        (noveltyScore * weights[tensionLevel].novelty) / 100 +
        (clueScore * weights[tensionLevel].clue) / 100 +
        (impactScore * weights[tensionLevel].impact) / 100 -
        branch.riskScore * weights[tensionLevel].risk;

      return { ...branch, recommendationScore: Math.round(score) };
    })
    .sort((a, b) =>
      (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0) ||
      a.riskScore - b.riskScore ||
      b.foreshadowNow.length - a.foreshadowNow.length ||
      b.preservedAnchorIds.reduce((sum, anchorId) => sum + weightFromAnchorId(anchorId), 0) -
        a.preservedAnchorIds.reduce((sum, anchorId) => sum + weightFromAnchorId(anchorId), 0)
    );

  return {
    recommendedBranchId: scoredBranches[0]?.id || '',
    scoredBranches,
  };
}

function knownEntityLexicon(project: Project): Set<string> {
  const values = [
    ...project.characters.map((character) => character.name),
    ...project.characters.flatMap((character) => character.aliases || []),
    ...project.world.factions,
    ...(project.foreshadowings || []).map((item) => item.description),
  ];
  return new Set(values.flatMap((value) => [value, ...splitClauses(value)]).map(normalizeStoryText).filter(Boolean));
}

function pushIssue(
  issues: DivergenceIssue[],
  severity: DivergenceIssue['severity'],
  code: DivergenceIssue['code'],
  message: string,
) {
  issues.push({ severity, code, message });
}

function getAnchorDetails(anchors: AnchorSet, minWeight = 1) {
  return anchors.all.filter((anchor) => anchor.weight >= minWeight);
}

function textContainsNegatedDetail(text: string, detail: string): boolean {
  const normalizedText = normalizeStoryText(text);
  const detailTokens = meaningfulTokens(detail);
  if (detailTokens.length === 0) return false;

  return detailTokens.some((token) => {
    const index = normalizedText.indexOf(token);
    if (index === -1) return false;
    const window = normalizedText.slice(Math.max(0, index - 18), index + token.length + 18);
    return NEGATION_TOKENS.some((negation) => window.includes(negation));
  });
}

export function validateDivergence(
  chapterText: string,
  ledger: ChapterLedger,
  project: Project,
  targetChapterIndex: number,
  branch: SurpriseBranch,
  anchors: AnchorSet,
): DivergenceReport {
  const issues: DivergenceIssue[] = [];
  let score = 100;

  if (targetChapterIndex > getChaptersChronological(project).length) {
    pushIssue(issues, 'warning', 'beat_delayed', 'targetChapterIndex vượt số chương hiện có, đang validate theo fallback.');
    score -= 10;
  }

  if ((branch.tensionLevel === 'follow' || branch.tensionLevel === 'nudge') && ledger.beatStatus === 'replace') {
    pushIssue(issues, 'warning', 'beat_skipped', 'Beat hiện tại bị thay thế hoàn toàn thay vì được xử lý.');
    score -= 20;
  }
  if ((branch.tensionLevel === 'follow' || branch.tensionLevel === 'nudge') && ledger.beatStatus === 'delay') {
    pushIssue(issues, 'warning', 'beat_delayed', 'Beat hiện tại bị trì hoãn thay vì được chạm tới ngay.');
    score -= 10;
  }

  const lexicon = knownEntityLexicon(project);
  const unknownEntities = dedupeStrings(ledger.introducedEntities).filter((entity) => !lexicon.has(normalizeStoryText(entity)));
  if (unknownEntities.length > 0) {
    unknownEntities.forEach((entity) => {
      pushIssue(issues, 'warning', 'new_entity_untracked', `Entity mới chưa có trong story memory: ${entity}.`);
    });
    score -= Math.min(20, unknownEntities.length * 10);
  }

  const preserved = new Set(ledger.preservedAnchorIds);
  getAnchorDetails(anchors, 3).forEach((anchor) => {
    if (!preserved.has(anchor.id)) {
      pushIssue(issues, 'critical', 'anchor_broken', `Anchor cứng không được giữ: ${anchor.label}.`);
      score -= 40;
    }
  });

  if (branch.tensionLevel === 'subvert' && ledger.foreshadowPlanted.length === 0) {
    pushIssue(issues, 'warning', 'missing_foreshadow', 'Nhánh subvert chưa gieo clue mới cho hậu quả của twist.');
    score -= 20;
  }

  const branchPreservedEndgame = new Set(branch.preservedAnchorIds);
  const hasEndgameCoverage = anchors.endgame.some((anchor) => anchor.weight === 3 && branchPreservedEndgame.has(anchor.id));
  if (!hasEndgameCoverage && anchors.endgame.length > 0) {
    pushIssue(issues, 'critical', 'endgame_drift', 'Nhánh đã chọn không giữ đủ liên kết tới endgame.');
    score -= 30;
  }

  anchors.establishedFact
    .filter((anchor) => anchor.weight >= 2)
    .forEach((anchor) => {
      if (textContainsNegatedDetail(chapterText, anchor.detail)) {
        pushIssue(issues, 'critical', 'fact_conflict', `Nội dung mới có dấu hiệu phủ định fact đã thiết lập: ${anchor.label}.`);
        score -= 30;
      }
    });

  const followUpActions = issues.some((issue) => issue.severity === 'critical') || score < 60
    ? ['Regenerate', 'Hạ tension', 'Chuyển Quick Draft']
    : issues.length > 0 || score < 85
    ? ['Regenerate cùng branch', 'Chọn branch khác', 'Lưu bản nháp và tự sửa']
    : [];

  const level =
    issues.some((issue) => issue.severity === 'critical') || score < 60
      ? 'critical'
      : issues.length > 0 || score < 85
      ? 'warning'
      : 'safe';

  return {
    level,
    score: Math.max(0, score),
    issues,
    followUpActions,
  };
}

export function dedupeForeshadowingDescriptions(existing: string[], planted: string[]): string[] {
  const existingSet = new Set(existing.map(normalizeStoryText));
  return dedupeStrings(planted).filter((item) => !existingSet.has(normalizeStoryText(item)));
}
