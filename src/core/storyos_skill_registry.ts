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

export interface SkillSourceRef {
  repository?: string;
  path?: string;
  sha?: string;
}

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
  source?: SkillSourceRef;
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
  /** Deterministic stage selection, e.g. review skills selected by the review stage. */
  requestedSkillIds?: string[];
  /** Stage boundary. Dependencies outside this allowlist are not allowed to leak across stages. */
  allowedDomains?: StorySkillDomain[];
  maxSkills?: number;
  maxTokens?: number;
}

export interface SkillRouter {
  buildPacket(request: SkillSelectionRequest): RuntimeSkillPacket;
}

const normalize = (value: string) => value.toLowerCase();
const estimateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

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

const compactValue = (value: string, maxChars: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
};

const compactList = (items: string[], maxItems: number, maxChars: number) =>
  items.slice(0, maxItems).map((item) => compactValue(item, maxChars));

/** Compile and physically truncate a skill so rendered content respects its token budget. */
const compileRuntimeSkill = (body: SkillBody): RuntimeSkill => {
  const tokenBudget = Math.max(100, body.manifest.tokenBudget || 600);
  let hardRules = compactList(body.hardRules, 8, 240);
  let guidance = compactList(body.guidance, 8, 260);
  let antiPatterns = compactList(body.antiPatterns, 6, 220);
  let outputContract = body.outputContract ? compactValue(body.outputContract, 500) : undefined;

  const snapshot = () => ({ hardRules, guidance, antiPatterns, outputContract });

  // Shrink the least authoritative material first. Hard rules survive longest.
  let guard = 0;
  while (estimateTokens(snapshot()) > tokenBudget && guard < 100) {
    guard += 1;
    if (guidance.length > 2) guidance = guidance.slice(0, -1);
    else if (antiPatterns.length > 2) antiPatterns = antiPatterns.slice(0, -1);
    else if (outputContract && outputContract.length > 120) outputContract = compactValue(outputContract, Math.max(120, outputContract.length - 80));
    else if (hardRules.length > 2) hardRules = hardRules.slice(0, -1);
    else {
      hardRules = hardRules.map((item) => compactValue(item, Math.max(60, Math.floor(item.length * 0.8))));
      guidance = guidance.map((item) => compactValue(item, Math.max(60, Math.floor(item.length * 0.8))));
      antiPatterns = antiPatterns.map((item) => compactValue(item, Math.max(50, Math.floor(item.length * 0.8))));
      if (outputContract) outputContract = compactValue(outputContract, Math.max(80, Math.floor(outputContract.length * 0.8)));
    }
  }

  const estimatedTokens = estimateTokens(snapshot());
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
  const allowed = request.allowedDomains ? new Set(request.allowedDomains) : undefined;
  const domainAllowed = (manifest: SkillManifest) => !allowed || allowed.has(manifest.domain);
  const manifestById = new Map(request.manifests.map((manifest) => [manifest.skillId, manifest]));

  const requested = new Set(request.requestedSkillIds ?? []);
  const ranked = request.manifests
    .filter((manifest) => manifest.status === 'active' && domainAllowed(manifest))
    .map((manifest, index) => ({
      manifest,
      index,
      score: requested.has(manifest.skillId) ? Number.MAX_SAFE_INTEGER : scoreManifest(manifest, taskText),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: RuntimeSkill[] = [];
  const selectedIds = new Set<string>();
  const visiting = new Set<string>();
  let totalEstimatedTokens = 0;

  const tryAdd = (skillId: string) => {
    if (selectedIds.has(skillId) || selected.length >= maxSkills || visiting.has(skillId)) return;
    const manifest = manifestById.get(skillId);
    const body = request.bodies[skillId];
    if (
      !manifest ||
      !body ||
      !domainAllowed(manifest) ||
      manifest.status !== 'active' ||
      body.manifest.status !== 'active'
    ) return;

    visiting.add(skillId);
    for (const dependency of manifest.dependencies) tryAdd(dependency);
    visiting.delete(skillId);

    if (selectedIds.has(skillId) || selected.length >= maxSkills) return;
    const compiled = compileRuntimeSkill(body);
    if (compiled.estimatedTokens > body.manifest.tokenBudget) return;
    if (totalEstimatedTokens + compiled.estimatedTokens > maxTokens) return;
    selected.push(compiled);
    selectedIds.add(skillId);
    totalEstimatedTokens += compiled.estimatedTokens;
  };

  for (const { manifest } of ranked) {
    tryAdd(manifest.skillId);
    if (selected.length >= maxSkills || totalEstimatedTokens >= maxTokens) break;
  }

  return {
    policy: 'manifest-first-v1',
    selected,
    totalEstimatedTokens,
  };
};

export const defaultSkillRouter: SkillRouter = {
  buildPacket: buildRuntimeSkillPacket,
};

export const renderRuntimeSkillPacket = (packet?: RuntimeSkillPacket) => {
  if (!packet || packet.selected.length === 0) return '';
  return packet.selected
    .map((skill) => {
      const parts = [`[Skill ${skill.skillId}@${skill.version}]`];
      if (skill.hardRules.length) parts.push(`Hard rules: ${skill.hardRules.join(' | ')}`);
      if (skill.guidance.length) parts.push(`Guidance: ${skill.guidance.join(' | ')}`);
      if (skill.antiPatterns.length) parts.push(`Avoid: ${skill.antiPatterns.join(' | ')}`);
      if (skill.outputContract) parts.push(`Output: ${skill.outputContract}`);
      return parts.join('\n');
    })
    .join('\n\n');
};
