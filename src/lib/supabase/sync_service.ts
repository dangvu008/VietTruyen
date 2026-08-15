/**
 * File: sync_service.ts
 * Purpose: Sync local Zustand data ↔ Supabase (bidirectional)
 * Layer: Infrastructure (Data Sync)
 * Domain: Sync → [upload local → cloud, download cloud → local]
 *
 * Data Contract:
 * - Input:  Local Project[] (from Zustand) + Supabase Project rows
 * - Output: Merged data (latest wins by updatedAt)
 * - Allowed Deps: supabase_client, types ONLY
 *
 * Strategy: updatedAt-based — newer version wins
 */

import { supabase } from './supabase_client';
import type { Project, Character, OutlineBeat, Chapter, WorldRules, Foreshadowing } from '../../types/story';

// ─── Upload a full project to Supabase ─────────────────────
export async function uploadProject(project: Project, userId: string): Promise<{ error: Error | null }> {
  // 1. Upsert main project row
  const { error: projectError } = await supabase
    .from('projects')
    .upsert({
      id: project.id,
      user_id: userId,
      title: project.title,
      logline: project.logline,
      genre: project.genre,
      sub_genre: project.subGenre,
      writing_style: project.writingStyle,
      narrative_era_register: project.narrativeEraRegister
        ? {
            frame: project.narrativeEraRegister.frame,
            confirmed: project.narrativeEraRegister.confirmed,
            source: project.narrativeEraRegister.source,
            notes: project.narrativeEraRegister.notes ?? null,
          }
        : null,
      tone: project.tone,
      style_id: project.styleId,
      target_chapters: project.targetChapters,
      endgame: project.endgame,
      main_character_count: project.mainCharacterCount,
      support_character_count: project.supportCharacterCount,
      character_setup: project.characterSetup,
      world_setting: project.worldSetting,
      main_plot: project.mainPlot,
      notes: project.notes,
      source_project_id: project.sourceProjectId || null,
      adaptation_type: project.adaptationType || null,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    }, { onConflict: 'id' });

  if (projectError) return { error: new Error(projectError.message) };

  // 2. Upsert world rules
  const { error: worldError } = await supabase
    .from('world_rules')
    .upsert({
      project_id: project.id,
      geography: project.world.geography,
      magic_system: project.world.magicSystem,
      tech_level: project.world.techLevel,
      currency: project.world.currency,
      factions: project.world.factions,
      rules: project.world.rules,
    }, { onConflict: 'project_id' });

  if (worldError) return { error: new Error(worldError.message) };

  // 3. Sync characters (delete old + insert new)
  await supabase.from('characters').delete().eq('project_id', project.id);
  if (project.characters.length > 0) {
    const chars = project.characters.map((c, i) => ({
      id: c.id,
      project_id: project.id,
      name: c.name,
      role: c.role,
      arc: c.arc,
      current_stage: c.currentStage,
      traits: c.traits,
      core_wound: c.psychology?.coreWound || '',
      deep_fear: c.psychology?.deepFear || '',
      hidden_desire: c.psychology?.hiddenDesire || '',
      self_deception: c.psychology?.selfDeception || '',
      body_language: c.psychology?.bodyLanguage || '',
      sort_order: i,
    }));
    await supabase.from('characters').insert(chars);
  }

  // 4. Sync outline beats
  await supabase.from('outline_beats').delete().eq('project_id', project.id);
  if (project.outline.length > 0) {
    const beats = project.outline.map((b, i) => ({
      id: b.id,
      project_id: project.id,
      title: b.title,
      summary: b.summary,
      focus: b.focus,
      sort_order: i,
    }));
    await supabase.from('outline_beats').insert(beats);
  }

  // 5. Sync chapters — SPLIT strategy to prevent stripped content from wiping Supabase.
  // partialize strips chapter content to '' when persisting to localStorage.
  // After reload, syncProjectMetadataToProvider may call uploadProject with
  // stripped chapters BEFORE hydration completes. If we blindly upsert content='',
  // we permanently destroy the real content on Supabase.
  //
  // Strategy:
  // - "Full" chapters (have content): upsert everything including content
  // - "Stripped" chapters (content='' but have title): upsert metadata ONLY
  //   (title, sort_order, status) — do NOT touch content/summary columns
  // - Orphan cleanup: only when we have a non-empty keep-set
  if (project.chapters.length > 0) {
    const fullChapters = project.chapters.filter((c) => c.content?.trim());
    const strippedChapters = project.chapters.filter((c) => !c.content?.trim());

    // [Domain:Storage] STEP 5a — Upsert full chapters (content present)
    if (fullChapters.length > 0) {
      const fullRows = fullChapters.map((c) => ({
        id: c.id,
        project_id: project.id,
        title: c.title,
        summary: c.summary || '',
        content: c.content,
        status: c.status,
        sort_order: project.chapters.indexOf(c),
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }));

      const { error: fullError } = await (supabase
        .from('chapters') as ReturnType<typeof supabase.from>)
        .upsert(fullRows, { onConflict: 'id' });

      if (fullError) {
        console.warn('[uploadProject] Full chapter upsert failed (non-fatal):', fullError.message);
      }
    }

    // [Domain:Storage] STEP 5b — Stripped chapters: metadata-only upsert
    // Only update title, sort_order, status — preserve existing content/summary on Supabase.
    // Uses individual UPDATE (not UPSERT) to avoid inserting new rows with empty content.
    if (strippedChapters.length > 0) {
      for (const c of strippedChapters) {
        const { error: metaError } = await supabase
          .from('chapters')
          .update({
            title: c.title,
            status: c.status,
            sort_order: project.chapters.indexOf(c),
            updated_at: c.updatedAt,
          })
          .eq('id', c.id)
          .eq('project_id', project.id);

        if (metaError) {
          console.warn(`[uploadProject] Metadata-only update for chapter ${c.id} failed:`, metaError.message);
        }
      }
    }

    // [Domain:Storage] STEP 5c — Remove orphan chapters not in the new set
    const keepIds = project.chapters.map((c) => c.id);
    if (keepIds.length > 0) {
      await supabase
        .from('chapters')
        .delete()
        .eq('project_id', project.id)
        .not('id', 'in', `(${keepIds.join(',')})`);
    }
  }
  // If project.chapters is empty we deliberately do NOT delete anything —
  // an empty array here most likely means "chapters were not loaded into this
  // snapshot" (stripped by partialize), NOT "the user deleted all chapters".

  // 6. Sync foreshadowings
  await supabase.from('foreshadowings').delete().eq('project_id', project.id);
  if (project.foreshadowings && project.foreshadowings.length > 0) {
    const items = project.foreshadowings.map((f) => ({
      id: f.id,
      project_id: project.id,
      description: f.description,
      related_entity_id: f.relatedEntityId || null,
      is_resolved: f.isResolved,
      created_at: f.createdAt,
    }));
    await supabase.from('foreshadowings').insert(items);
  }

  return { error: null };
}

// ─── Download all projects from Supabase for current user ──
export async function downloadProjects(): Promise<{ data: Project[]; error: Error | null }> {
  // Fetch projects
  const { data: rows, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !rows) return { data: [], error: error ? new Error(error.message) : null };

  const projects: Project[] = [];

  for (const row of rows) {
    // Fetch related data
    const [worldRes, charsRes, beatsRes, chaptersRes, foreshadowingsRes] = await Promise.all([
      supabase.from('world_rules').select('*').eq('project_id', row.id).maybeSingle(),
      supabase.from('characters').select('*').eq('project_id', row.id).order('sort_order'),
      supabase.from('outline_beats').select('*').eq('project_id', row.id).order('sort_order'),
      supabase.from('chapters').select('*').eq('project_id', row.id).order('sort_order'),
      supabase.from('foreshadowings').select('*').eq('project_id', row.id).order('created_at'),
    ]);

    const world: WorldRules = worldRes.data
      ? {
          geography: worldRes.data.geography || '',
          magicSystem: worldRes.data.magic_system || '',
          techLevel: worldRes.data.tech_level || '',
          currency: worldRes.data.currency || '',
          factions: worldRes.data.factions || [],
          rules: worldRes.data.rules || '',
        }
      : { geography: '', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '' };

    const characters: Character[] = (charsRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role || '',
      arc: c.arc || '',
      currentStage: c.current_stage || '',
      traits: c.traits || '',
      psychology: {
        coreWound: c.core_wound || '',
        deepFear: c.deep_fear || '',
        hiddenDesire: c.hidden_desire || '',
        selfDeception: c.self_deception || '',
        bodyLanguage: c.body_language || '',
      },
    }));

    const outline: OutlineBeat[] = (beatsRes.data || []).map((b) => ({
      id: b.id,
      title: b.title,
      summary: b.summary || '',
      focus: b.focus || '',
    }));

    const chapters: Chapter[] = (chaptersRes.data || []).map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary || undefined,
      content: c.content || '',
      status: c.status as 'draft' | 'revised' | 'final',
      createdAt: c.created_at || new Date().toISOString(),
      updatedAt: c.updated_at || new Date().toISOString(),
    }));

    const foreshadowings: Foreshadowing[] = (foreshadowingsRes.data || []).map((f) => ({
      id: f.id,
      description: f.description,
      relatedEntityId: f.related_entity_id || undefined,
      isResolved: f.is_resolved || false,
      createdAt: f.created_at || new Date().toISOString(),
    }));

    projects.push({
      id: row.id,
      title: row.title,
      logline: row.logline || '',
      genre: row.genre || '',
      subGenre: row.sub_genre || [],
      writingStyle: row.writing_style || '',
      narrativeEraRegister: (row.narrative_era_register as unknown as Project['narrativeEraRegister']) || undefined,
      tone: row.tone || '',
      styleId: row.style_id || '',
      targetChapters: row.target_chapters || 60,
      endgame: row.endgame || '',
      mainCharacterCount: row.main_character_count || 2,
      supportCharacterCount: row.support_character_count || 3,
      characterSetup: row.character_setup || '',
      worldSetting: row.world_setting || '',
      mainPlot: row.main_plot || '',
      world,
      characters,
      outline,
      chapters,
      foreshadowings,
      notes: row.notes || '',
      canonVersion: 1,
      storageMode: 'cloud',
      arcCount: 0,
      hasGlobalIndex: false,
      sourceProjectId: row.source_project_id || undefined,
      adaptationType: row.adaptation_type as any,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    });
  }

  return { data: projects, error: null };
}

// ─── Sync all local projects to cloud ──────────────────────
export async function syncAllProjects(
  localProjects: Project[],
  userId: string
): Promise<{ error: Error | null }> {
  for (const project of localProjects) {
    const { error } = await uploadProject(project, userId);
    if (error) {
      console.error(`[Sync] Failed to upload project "${project.title}":`, error.message);
      return { error };
    }
  }
  return { error: null };
}