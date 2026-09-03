export type StorySkillDomain =
  | 'advisor'
  | 'design'
  | 'planning'
  | 'prose'
  | 'style'
  | 'review'
  | 'proofread'
  | 'memory'
  | 'state';

export interface SkillManifest {
  skillId: string;
  version: string;
  domain: StorySkillDomain;
  status: 'draft' | 'active' | 'deprecated';
  purpose: string;
  triggers: string[];
  dependencies: string[];
  authorityRequirements: string[];
  tokenBudget: number;
}

export interface SkillBody {
  manifest: SkillManifest;
  hardRules: string[];
  guidance: string[];
  antiPatterns: string[];
  outputContract?: string;
}

export interface RuntimeSkill {
  skillId: string;
  version: string;
  hardRules: string[];
  guidance: string[];
  antiPatterns: string[];
  outputContract?: string;
  estimatedTokens: number;
}

export interface RuntimeSkillPacket {
  policy: 'manifest-first-v1';
  selected: RuntimeSkill[];
  totalEstimatedTokens: number;
}

export interface SkillSelectionRequest {
  taskText: string;
  mode: 'create' | 'rewrite' | 'continue' | 'polish';
  manifests: SkillManifest[];
  bodies: Record<string, SkillBody | undefined>;
  maxSkills?: number;
  maxTokens?: number;
}

const normalize = (value: string) => value.toLowerCase();

const scoreManifest = (manifest: SkillManifest, taskText: string) => {
  const haystack = normalize(taskText);
  let score = 0;
  for (const trigger of manifest.triggers) {
    const normalized = normalize(trigger).trim();
    if (normalized && haystack.includes(normalized)) score += 3;
  }
  for (const word of normalize(`${manifest.skillId} ${manifest.purpose}`).split(/[^\p{L}\p{N}.]+/u)) {
    if (word.length >= 4 && haystack.includes(word)) score += 1;
  }
  return score;
};

const compactList = (items: string[], maxItems: number, maxChars: number) =>
  items.slice(0, maxItems).map((item) => {
    const value = item.replace(/\s+/g, ' ').trim();
    return value.length <= maxChars ? value : `${value.slice(0, maxChars).trim()}…`;
  });

const compileRuntimeSkill = (body: SkillBody): RuntimeSkill => {
  const tokenBudget = Math.max(100, body.manifest.tokenBudget || 600);
  const hardRules = compactList(body.hardRules, 8, 240);
  const guidance = compactList(body.guidance, 8, 260);
  const antiPatterns = compactList(body.antiPatterns, 6, 220);
  const outputContract = body.outputContract
    ? body.outputContract.replace(/\s+/g, ' ').trim().slice(0, 500)
    : undefined;
  const estimatedTokens = Math.min(
    tokenBudget,
    Math.ceil(JSON.stringify({ hardRules, guidance, antiPatterns, outputContract }).length / 4),
  );
  return {
    skillId: body.manifest.skillId,
    version: body.manifest.version,
    hardRules,
    guidance,
    antiPatterns,
    outputContract,
    estimatedTokens,
  };
};

/**
 * Manifest-first router: selection only inspects tiny manifests. Full bodies are read only
 * for selected skills and compiled into a bounded packet before reaching Writer/Reviewer.
 */
export const buildRuntimeSkillPacket = (request: SkillSelectionRequest): RuntimeSkillPacket => {
  const maxSkills = request.maxSkills ?? 5;
  const maxTokens = request.maxTokens ?? 3200;
  const taskText = `${request.mode} ${request.taskText}`;

  const ranked = request.manifests
    .filter((manifest) => manifest.status === 'active')
    .map((manifest, index) => ({ manifest, index, score: scoreManifest(manifest, taskText) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: RuntimeSkill[] = [];
  const selectedIds = new Set<string>();
  let totalEstimatedTokens = 0;

  const tryAdd = (skillId: string) => {
    if (selectedIds.has(skillId) || selected.length >= maxSkills) return;
    const body = request.bodies[skillId];
    if (!body || body.manifest.status !== 'active') return;
    const compiled = compileRuntimeSkill(body);
    if (totalEstimatedTokens + compiled.estimatedTokens > maxTokens) return;
    selected.push(compiled);
    selectedIds.add(skillId);
    totalEstimatedTokens += compiled.estimatedTokens;
  };

  for (const { manifest } of ranked) {
    for (const dependency of manifest.dependencies) tryAdd(dependency);
    tryAdd(manifest.skillId);
    if (selected.length >= maxSkills || totalEstimatedTokens >= maxTokens) break;
  }

  return {
    policy: 'manifest-first-v1',
    selected,
    totalEstimatedTokens,
  };
};
