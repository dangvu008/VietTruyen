/**
 * File: narrative_index_exporter.ts
 * Purpose: Export IndexedDB narrative state → human-readable markdown for
 *          author review and AI context routing. Inspired by Karpathy's
 *          Obsidian RAG Master Index concept.
 * Layer: Memory → View
 * Domain: NarrativeMemory
 * Deps: memory_query, narrative_db, hierarchical_summary_cache, story types
 *
 * Design:
 * - Outputs are DERIVED VIEWS, NOT source of truth (IndexedDB remains canonical)
 * - masterIndex: routing map (~200-400 tokens) — AI reads this first to decide queries
 * - characterWiki: detailed per-character state + timeline milestones
 * - storyTimeline: chronological event log per chapter
 */

import type { Project, Arc, Foreshadowing, Character } from '../../types/story';
import type { EntityDefinition, EntitySnapshot } from '../../types/narrative_memory';
import type { NarrativeNode, NarrativeEdge, NarrativeCommunity } from '../../types/narrative_graph';
import { getEntityDefinitions, getProjectArcs } from '../../db/narrative_db';
import {
  getEntityTimelineSnapshots,
  getEntitySnapshotAt,
} from './memory_query';
import { retrieveHscContext } from './hierarchical_summary_cache';
import { getChaptersChronological } from '../ai/surprise_engine';

// ─── Public Interface ────────────────────────────────────

export interface NarrativeIndex {
  /** High-level routing map for AI + human overview (~200-400 tokens) */
  masterIndex: string;
  /** Detailed per-character wiki: attributes, timeline, relationships */
  characterWiki: string;
  /** Chronological event timeline derived from chapter summaries + entity diffs */
  storyTimeline: string;
  /** Timestamp of export */
  exportedAt: string;
}

// ─── Constants ───────────────────────────────────────────

const MAX_RECENT_EVENTS = 5;
const MAX_OPEN_THREADS = 8;
const MAX_MILESTONE_PER_CHARACTER = 5;
const TRAIT_TRUNCATE = 80;

// ─── Helper: Truncate ────────────────────────────────────

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

// ─── Master Index Builder ────────────────────────────────

/**
 * [Domain:NarrativeMemory] STEP 1 — Build routing-optimized master index.
 * Designed to be loaded first by AI to decide which detailed queries to run.
 * Token budget: ~200-400 tokens.
 */
function buildMasterIndexSection(
  project: Project,
  arcs: Arc[],
  entities: EntityDefinition[],
  totalChapters: number,
): string {
  const lines: string[] = [];
  lines.push(`# ${project.title} — Narrative Index (Ch.1-${totalChapters})`);
  lines.push('');

  // Characters section
  const characters = project.characters || [];
  if (characters.length > 0) {
    lines.push(`## Characters (${characters.length})`);
    for (const char of characters) {
      const stage = char.currentStage ? ` → ${truncate(char.currentStage, 30)}` : '';
      const aliases = char.aliases?.length ? ` aka ${char.aliases.join(', ')}` : '';
      lines.push(`- ${char.name} [${char.role}]${stage}${aliases}`);
    }
    lines.push('');
  }

  // Arcs section
  if (arcs.length > 0) {
    lines.push(`## Arcs (${arcs.length})`);
    for (const arc of arcs) {
      const chapterRange = `Ch.${arc.chapterStart}-${arc.chapterEnd}`;
      const summary = arc.summary ? truncate(arc.summary, 60) : arc.premise ? truncate(arc.premise, 60) : '';
      lines.push(`- Arc ${arc.index + 1} "${arc.title || arc.label}" (${chapterRange}): ${summary}`);
    }
    lines.push('');
  }

  // Foreshadowing / Open Threads
  const openThreads = (project.foreshadowings || []).filter((f) => !f.isResolved);
  if (openThreads.length > 0) {
    lines.push(`## Open Threads (${openThreads.length})`);
    for (const thread of openThreads.slice(0, MAX_OPEN_THREADS)) {
      lines.push(`- ${truncate(thread.description, 80)} (planted ${thread.createdAt.slice(0, 10)})`);
    }
    lines.push('');
  }

  // Entities discovered beyond project.characters (from extraction)
  const characterIds = new Set(characters.map((c) => c.id));
  const extraEntities = entities.filter(
    (e) => !characterIds.has(e.entityId) && e.entityType !== 'world'
  );
  if (extraEntities.length > 0) {
    lines.push(`## Extracted Entities (${extraEntities.length})`);
    for (const entity of extraEntities.slice(0, 10)) {
      lines.push(`- ${entity.canonicalName} [${entity.entityType}]`);
    }
    lines.push('');
  }

  // Recent events (last N chapters)
  const chapters = getChaptersChronological(project);
  const recentStart = Math.max(0, chapters.length - MAX_RECENT_EVENTS);
  const recentChapters = chapters.slice(recentStart);
  if (recentChapters.length > 0) {
    lines.push(`## Recent Events (Ch.${recentStart + 1}-${chapters.length})`);
    for (let i = 0; i < recentChapters.length; i++) {
      const ch = recentChapters[i];
      const chNum = recentStart + i + 1;
      const summary = ch.summary ? truncate(ch.summary, 80) : truncate(ch.content, 80);
      lines.push(`- Ch.${chNum}: ${summary}`);
    }
    lines.push('');
  }

  // World brief (1-liner)
  const world = project.world;
  if (world.geography || world.magicSystem) {
    lines.push('## World');
    if (world.geography) lines.push(`- Setting: ${truncate(world.geography, 60)}`);
    if (world.magicSystem) lines.push(`- System: ${truncate(world.magicSystem, 60)}`);
    if (world.factions?.length) lines.push(`- Factions: ${world.factions.join(', ')}`);
  }

  return lines.join('\n');
}

// ─── Character Wiki Builder ──────────────────────────────

/**
 * [Domain:NarrativeMemory] STEP 2 — Build per-character detailed wiki.
 * Shows current state + key milestones. For author reference + AI deep context.
 */
async function buildCharacterWikiSection(
  project: Project,
  entities: EntityDefinition[],
  totalChapters: number,
): Promise<string> {
  const lines: string[] = [];
  lines.push(`# Character Wiki — ${project.title}`);
  lines.push('');

  const characters = project.characters || [];
  if (characters.length === 0) {
    lines.push('*No characters defined yet.*');
    return lines.join('\n');
  }

  for (const char of characters) {
    lines.push(`## ${char.name}`);
    lines.push(`- **Role:** ${char.role}`);
    if (char.traits) lines.push(`- **Traits:** ${truncate(char.traits, TRAIT_TRUNCATE)}`);
    if (char.currentStage) lines.push(`- **Current Stage:** ${char.currentStage}`);
    if (char.arc) lines.push(`- **Arc:** ${truncate(char.arc, 100)}`);
    if (char.aliases?.length) lines.push(`- **Aliases:** ${char.aliases.join(', ')}`);

    // Get entity definition for enriched attributes
    const entityDef = entities.find(
      (e) => e.entityId === char.id && e.entityType === 'character'
    );
    if (entityDef) {
      const attrEntries = Object.entries(entityDef.attributes)
        .filter(([key]) => !['name', 'role', 'traits', 'arc'].includes(key))
        .slice(0, 8);
      if (attrEntries.length > 0) {
        lines.push('- **Attributes:**');
        for (const [key, value] of attrEntries) {
          lines.push(`  - ${key}: ${truncate(value, 60)}`);
        }
      }
    }

    // Timeline milestones
    const snapshots = await getEntityTimelineSnapshots(project.id, char.id).catch(() => []);
    const relevantSnapshots = snapshots
      .filter((s) => s.chapterIndex > 0 && s.chapterIndex <= totalChapters && s.diffs.length > 0)
      .sort((a, b) => a.chapterIndex - b.chapterIndex);

    if (relevantSnapshots.length > 0) {
      lines.push('- **Key Milestones:**');
      // Sample evenly if too many
      const sampled = sampleMilestones(relevantSnapshots, MAX_MILESTONE_PER_CHARACTER);
      for (const snapshot of sampled) {
        const changes = snapshot.diffs
          .slice(0, 2)
          .map((d) => `${d.key}: ${truncate(d.newValue, 40)}`)
          .join('; ');
        lines.push(`  - Ch.${snapshot.chapterIndex}: ${changes}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function sampleMilestones(snapshots: EntitySnapshot[], limit: number): EntitySnapshot[] {
  if (snapshots.length <= limit) return snapshots;

  // Always include first and last, evenly sample middle
  const result: EntitySnapshot[] = [snapshots[0]];
  const step = (snapshots.length - 1) / (limit - 1);
  for (let i = 1; i < limit - 1; i++) {
    result.push(snapshots[Math.round(i * step)]);
  }
  result.push(snapshots[snapshots.length - 1]);
  return result;
}

// ─── Story Timeline Builder ─────────────────────────────

/**
 * [Domain:NarrativeMemory] STEP 3 — Build chronological story timeline.
 * Lists chapter summaries + notable entity changes per chapter.
 */
function buildStoryTimelineSection(
  project: Project,
  arcs: Arc[],
): string {
  const lines: string[] = [];
  lines.push(`# Story Timeline — ${project.title}`);
  lines.push('');

  const chapters = getChaptersChronological(project);
  if (chapters.length === 0) {
    lines.push('*No chapters written yet.*');
    return lines.join('\n');
  }

  // Build arc lookup for chapter → arc mapping
  const chapterArcMap = new Map<number, string>();
  for (const arc of arcs) {
    for (let ch = arc.chapterStart; ch <= arc.chapterEnd; ch++) {
      chapterArcMap.set(ch, arc.title || arc.label);
    }
  }

  let currentArc = '';
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterNum = i + 1;
    const arcName = chapterArcMap.get(chapterNum);

    // Insert arc header when arc changes
    if (arcName && arcName !== currentArc) {
      currentArc = arcName;
      lines.push(`### Arc: ${arcName}`);
    }

    const summary = chapter.summary
      ? truncate(chapter.summary, 120)
      : truncate(chapter.content, 120);
    lines.push(`- **Ch.${chapterNum}** "${chapter.title}": ${summary}`);
  }

  // Resolved foreshadowings summary
  const resolved = (project.foreshadowings || []).filter((f) => f.isResolved);
  if (resolved.length > 0) {
    lines.push('');
    lines.push('### Resolved Threads');
    for (const thread of resolved) {
      lines.push(`- ✅ ${truncate(thread.description, 80)}`);
    }
  }

  return lines.join('\n');
}

// ─── Main Export Function ────────────────────────────────

/**
 * [Domain:NarrativeMemory] STEP 4 — Export complete narrative index.
 * Aggregates master index + character wiki + story timeline.
 *
 * Usage:
 * - Author: Opens in UI panel to review narrative state
 * - AI: Reads masterIndex first → decides which detailed section to load
 */
export async function exportNarrativeIndex(
  project: Project,
  targetChapterIndex?: number,
): Promise<NarrativeIndex> {
  const chapters = getChaptersChronological(project);
  const totalChapters = targetChapterIndex ?? chapters.length;

  const [arcs, entities] = await Promise.all([
    getProjectArcs(project.id).catch(() => [] as Arc[]),
    getEntityDefinitions(project.id).catch(() => [] as EntityDefinition[]),
  ]);

  const masterIndex = buildMasterIndexSection(project, arcs, entities, totalChapters);
  const characterWiki = await buildCharacterWikiSection(project, entities, totalChapters);
  const storyTimeline = buildStoryTimelineSection(project, arcs);

  return {
    masterIndex,
    characterWiki,
    storyTimeline,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * [Domain:NarrativeMemory] STEP 5 — Export master index only (lightweight).
 * For AI routing — costs ~200-400 tokens.
 */
export async function exportMasterIndexOnly(
  project: Project,
): Promise<string> {
  const chapters = getChaptersChronological(project);
  const [arcs, entities] = await Promise.all([
    getProjectArcs(project.id).catch(() => [] as Arc[]),
    getEntityDefinitions(project.id).catch(() => [] as EntityDefinition[]),
  ]);

  return buildMasterIndexSection(project, arcs, entities, chapters.length);
}
