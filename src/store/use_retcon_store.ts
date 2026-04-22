import { create } from 'zustand';
import { createId } from '../core/id';
import { previewCanonicalEdits, persistPropagationPreview } from '../lib/memory/propagation_engine';
import type { CanonicalEdit, EntityType, PropagationPreview } from '../types/narrative_memory';
import { buildCharacterAttributes, buildWorldAttributes, normalizeAttributeKey } from '../lib/memory/memory_registry';

type EditableEntityType = 'character' | 'world';

interface DraftChange {
  attributeKey: string;
  oldValue: string;
  newValue: string;
}

interface AnalysisParams {
  projectId: string;
  entityType: EditableEntityType;
  entityId: string;
  oldEntity: any;
  newEntity: any;
  effectiveFromChapter?: number;
  reason?: string;
  onApplyChanges: () => void;
}

interface RetconState {
  isOpen: boolean;
  isAnalyzing: boolean;
  projectId: string | null;
  entityType: EditableEntityType | null;
  entityId: string | null;
  originalEntity: any | null;
  pendingEntityChange: any | null;
  draftChanges: DraftChange[];
  edits: CanonicalEdit[];
  preview: PropagationPreview | null;
  effectiveFromChapter: number;
  reason: string;
  applyCallback: (() => void) | null;

  startAnalysis: (params: AnalysisParams) => Promise<void>;
  setEffectiveFromChapter: (value: number) => Promise<void>;
  setReason: (value: string) => Promise<void>;
  applyChanges: () => Promise<void>;
  closeModal: () => void;
}

function buildAttributes(entityType: EditableEntityType, entity: any): Record<string, string> {
  return entityType === 'character'
    ? buildCharacterAttributes(entity)
    : buildWorldAttributes(entity);
}

function diffEntities(entityType: EditableEntityType, oldEntity: any, newEntity: any): DraftChange[] {
  const previous = buildAttributes(entityType, oldEntity);
  const next = buildAttributes(entityType, newEntity);
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));

  return keys
    .map((key) => ({
      attributeKey: normalizeAttributeKey(key),
      oldValue: previous[key] || '',
      newValue: next[key] || '',
    }))
    .filter((change) => change.oldValue !== change.newValue);
}

function buildEdits(
  projectId: string,
  entityType: EditableEntityType,
  entityId: string,
  draftChanges: DraftChange[],
  effectiveFromChapter: number,
  reason: string
): CanonicalEdit[] {
  const now = new Date().toISOString();
  return draftChanges.map((change) => ({
    id: createId(),
    projectId,
    entityId,
    entityType: entityType as EntityType,
    attributeKey: change.attributeKey,
    oldValue: change.oldValue,
    newValue: change.newValue,
    effectiveFromChapter,
    reason,
    sourceType: 'canonical_edit',
    confidence: 1,
    propagationStatus: 'ready',
    createdAt: now,
  }));
}

export const useRetconStore = create<RetconState>((set, get) => ({
  isOpen: false,
  isAnalyzing: false,
  projectId: null,
  entityType: null,
  entityId: null,
  originalEntity: null,
  pendingEntityChange: null,
  draftChanges: [],
  edits: [],
  preview: null,
  effectiveFromChapter: 1,
  reason: 'Cập nhật canon',
  applyCallback: null,

  startAnalysis: async ({
    projectId,
    entityType,
    entityId,
    oldEntity,
    newEntity,
    effectiveFromChapter = 1,
    reason = 'Cập nhật canon',
    onApplyChanges,
  }) => {
    const draftChanges = diffEntities(entityType, oldEntity, newEntity);

    set({
      isOpen: true,
      isAnalyzing: true,
      projectId,
      entityType,
      entityId,
      originalEntity: oldEntity,
      pendingEntityChange: newEntity,
      draftChanges,
      edits: [],
      preview: null,
      effectiveFromChapter,
      reason,
      applyCallback: onApplyChanges,
    });

    if (draftChanges.length === 0) {
      set({
        isAnalyzing: false,
        preview: {
          id: createId(),
          projectId,
          edits: [],
          blastRadius: [],
          taskQueue: [],
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }

    const edits = buildEdits(projectId, entityType, entityId, draftChanges, effectiveFromChapter, reason);
    const preview = await previewCanonicalEdits(projectId, edits);

    set({
      isAnalyzing: false,
      edits,
      preview,
    });
  },

  setEffectiveFromChapter: async (value) => {
    const state = get();
    const effectiveFromChapter = Math.max(1, Math.floor(value || 1));

    set({
      effectiveFromChapter,
      isAnalyzing: true,
    });

    if (!state.projectId || !state.entityId || !state.entityType) {
      set({ isAnalyzing: false });
      return;
    }

    const edits = buildEdits(
      state.projectId,
      state.entityType,
      state.entityId,
      state.draftChanges,
      effectiveFromChapter,
      state.reason
    );
    const preview = await previewCanonicalEdits(state.projectId, edits);

    set({
      effectiveFromChapter,
      isAnalyzing: false,
      edits,
      preview,
    });
  },

  setReason: async (value) => {
    const reason = value || 'Cập nhật canon';
    const state = get();

    set({
      reason,
      isAnalyzing: true,
    });

    if (!state.projectId || !state.entityId || !state.entityType) {
      set({ isAnalyzing: false });
      return;
    }

    const edits = buildEdits(
      state.projectId,
      state.entityType,
      state.entityId,
      state.draftChanges,
      state.effectiveFromChapter,
      reason
    );
    const preview = await previewCanonicalEdits(state.projectId, edits);

    set({
      reason,
      isAnalyzing: false,
      edits,
      preview,
    });
  },

  applyChanges: async () => {
    const state = get();
    if (!state.preview) return;

    state.applyCallback?.();
    if (state.preview.edits.length > 0) {
      await persistPropagationPreview(state.preview);
    }

    get().closeModal();
  },

  closeModal: () => {
    set({
      isOpen: false,
      isAnalyzing: false,
      projectId: null,
      entityType: null,
      entityId: null,
      originalEntity: null,
      pendingEntityChange: null,
      draftChanges: [],
      edits: [],
      preview: null,
      effectiveFromChapter: 1,
      reason: 'Cập nhật canon',
      applyCallback: null,
    });
  },
}));
