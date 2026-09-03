import type { SkillBody, SkillManifest, StorySkillDomain } from './storyos_skill_registry';
import type { ChapterStateProposal, StoryAuthorityAdapter } from './storyos_state_loop';

/** Storage-neutral row shape expected from a Notion Skill Registry database adapter. */
export interface NotionSkillRow {
  skillId: string;
  version: string;
  domain: StorySkillDomain;
  status: 'draft' | 'active' | 'deprecated';
  purpose: string;
  triggers?: string[];
  dependencies?: string[];
  authorityRequirements?: string[];
  tokenBudget?: number;
  hardRules?: string[];
  guidance?: string[];
  antiPatterns?: string[];
  outputContract?: string;
  sourceRepository?: string;
  sourcePath?: string;
  sourceSha?: string;
}

export interface NotionSkillRegistrySnapshot {
  manifests: SkillManifest[];
  bodies: Record<string, SkillBody>;
}

const unique = (items?: string[]) => [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))];

/**
 * Converts rows fetched from Notion into the Harness contract. Network access and Notion SDK
 * details stay outside core StoryOS so tests and Writer logic remain storage agnostic.
 */
export const compileNotionSkillRegistry = (rows: NotionSkillRow[]): NotionSkillRegistrySnapshot => {
  const bySkill = new Map<string, NotionSkillRow>();

  for (const row of rows) {
    const current = bySkill.get(row.skillId);
    if (!current || row.version.localeCompare(current.version, undefined, { numeric: true }) > 0) {
      bySkill.set(row.skillId, row);
    }
  }

  const bodies: Record<string, SkillBody> = {};
  const manifests: SkillManifest[] = [];

  for (const row of bySkill.values()) {
    const manifest: SkillManifest = {
      skillId: row.skillId,
      version: row.version,
      domain: row.domain,
      status: row.status,
      purpose: row.purpose.trim(),
      triggers: unique(row.triggers),
      dependencies: unique(row.dependencies),
      authorityRequirements: unique(row.authorityRequirements),
      tokenBudget: Math.min(1600, Math.max(100, row.tokenBudget ?? 600)),
      source: row.sourceRepository || row.sourcePath || row.sourceSha
        ? { repository: row.sourceRepository, path: row.sourcePath, sha: row.sourceSha }
        : undefined,
    };
    const body: SkillBody = {
      manifest,
      hardRules: unique(row.hardRules),
      guidance: unique(row.guidance),
      antiPatterns: unique(row.antiPatterns),
      outputContract: row.outputContract?.trim() || undefined,
    };
    manifests.push(manifest);
    bodies[manifest.skillId] = body;
  }

  return { manifests, bodies };
};

/** Minimal port that a real Notion connector/SDK implementation must provide. */
export interface NotionStoryOsPort {
  fetchSkillRows(): Promise<NotionSkillRow[]>;
  fetchCanonVersion(projectId: string): Promise<number>;
  appendAcceptedChapterProposal(
    proposal: ChapterStateProposal,
    nextCanonVersion: number,
  ): Promise<void>;
}

export const createNotionAuthorityAdapter = (port: NotionStoryOsPort): StoryAuthorityAdapter => ({
  readCanonVersion: (projectId) => port.fetchCanonVersion(projectId),
  commitChapterProposal: (proposal, nextCanonVersion) => port.appendAcceptedChapterProposal(proposal, nextCanonVersion),
});
