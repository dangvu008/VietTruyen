import { create } from 'zustand';
import { createId } from '../core/id';
import {
  getProjectArcs,
  getProjectImpactScans,
  getProjectRewriteTasks,
  getProjectSurgerySpecs,
  storeSurgerySpec,
} from '../db/narrative_db';
import {
  buildProjectIndex,
  enqueueRewriteTasks,
  freezeCanon,
  rewriteArc,
  rewriteChapterTask,
  runGlobalImpactScan,
} from '../lib/surgery';
import type {
  CanonFreezeResult,
  ImpactScanResult,
  RemovalDirective,
  RewriteTask,
  SurgerySpec,
} from '../types/surgery';
import type { Arc } from '../types/story';
import {
  persistSurgerySession,
  loadSurgerySession,
  clearSurgerySession,
  type PersistedSurgerySession,
} from '../lib/surgery/surgery_session_persist';

interface SurgeryState {
  arcs: Arc[];
  specs: SurgerySpec[];
  scans: ImpactScanResult[];
  tasks: RewriteTask[];
  isLoading: boolean;
  error: string | null;
  activeSession: PersistedSurgerySession | null;
  refreshProjectData: (projectId: string) => Promise<void>;
  createDraftSpec: (projectId: string) => Promise<SurgerySpec>;
  saveSpec: (spec: SurgerySpec) => Promise<void>;
  addDirectiveToSpec: (specId: string, directive: RemovalDirective) => Promise<void>;
  buildIndex: (projectId: string) => Promise<void>;
  runScan: (projectId: string, specId: string) => Promise<ImpactScanResult>;
  freezeProjectCanon: (projectId: string, specId: string) => Promise<CanonFreezeResult>;
  buildRewriteQueue: (projectId: string, scanId: string) => Promise<RewriteTask[]>;
  applyArcRewrite: (projectId: string, arcId: string, specId: string) => Promise<void>;
  applyChapterRewrite: (projectId: string, taskId: string) => Promise<void>;
  resumeSession: (projectId: string) => Promise<PersistedSurgerySession | null>;
  endSession: (projectId: string) => void;
}

const now = () => new Date().toISOString();

export const useSurgeryStore = create<SurgeryState>((set, get) => ({
  arcs: [],
  specs: [],
  scans: [],
  tasks: [],
  isLoading: false,
  error: null,
  activeSession: null,

  refreshProjectData: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const [arcs, specs, scans, tasks] = await Promise.all([
        getProjectArcs(projectId),
        getProjectSurgerySpecs(projectId),
        getProjectImpactScans(projectId),
        getProjectRewriteTasks(projectId),
      ]);
      set({
        arcs,
        specs: specs.slice().reverse(),
        scans: scans.slice().reverse(),
        tasks,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Không thể tải surgery data.' });
    }
  },

  createDraftSpec: async (projectId) => {
    const spec: SurgerySpec = {
      id: createId(),
      projectId,
      title: `Surgery Spec ${new Date().toLocaleDateString('vi-VN')}`,
      description: '',
      status: 'draft',
      directives: [],
      assumptions: [],
      blockedReasons: [],
      sourceFormat: 'project',
      createdAt: now(),
      updatedAt: now(),
    };
    await storeSurgerySpec(spec);
    await get().refreshProjectData(projectId);
    return spec;
  },

  saveSpec: async (spec) => {
    await storeSurgerySpec({
      ...spec,
      updatedAt: now(),
    });
    await get().refreshProjectData(spec.projectId);
  },

  addDirectiveToSpec: async (specId, directive) => {
    const spec = get().specs.find((item) => item.id === specId);
    if (!spec) throw new Error('Không tìm thấy spec để thêm directive.');
    await storeSurgerySpec({
      ...spec,
      directives: [...spec.directives, directive],
      updatedAt: now(),
    });
    await get().refreshProjectData(spec.projectId);
  },

  buildIndex: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      await buildProjectIndex(projectId);
      await get().refreshProjectData(projectId);
      const session = get().activeSession;
      if (session) {
        const updated = { ...session, step: 'index' as const, savedAt: now() };
        persistSurgerySession(updated);
        set({ activeSession: updated });
      }
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Build index thất bại.' });
    }
  },

  runScan: async (projectId, specId) => {
    set({ isLoading: true, error: null });
    try {
      const scan = await runGlobalImpactScan(projectId, specId);
      await get().refreshProjectData(projectId);
      const session: PersistedSurgerySession = {
        projectId,
        specId,
        step: 'scan',
        completedTasks: [],
        savedAt: now(),
      };
      persistSurgerySession(session);
      set({ activeSession: session });
      return scan;
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Impact scan thất bại.' });
      throw error;
    }
  },

  freezeProjectCanon: async (projectId, specId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await freezeCanon(projectId, specId);
      await get().refreshProjectData(projectId);
      const session: PersistedSurgerySession = {
        projectId,
        specId,
        step: 'freeze',
        completedTasks: get().activeSession?.completedTasks ?? [],
        savedAt: now(),
      };
      persistSurgerySession(session);
      set({ activeSession: session });
      return result;
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Freeze canon thất bại.' });
      throw error;
    }
  },

  buildRewriteQueue: async (projectId, scanId) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await enqueueRewriteTasks(projectId, scanId);
      await get().refreshProjectData(projectId);
      const prev = get().activeSession;
      if (prev) {
        const updated: PersistedSurgerySession = { ...prev, step: 'rewrite', savedAt: now() };
        persistSurgerySession(updated);
        set({ activeSession: updated });
      }
      return tasks;
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Tạo rewrite queue thất bại.' });
      throw error;
    }
  },

  applyArcRewrite: async (projectId, arcId, specId) => {
    set({ isLoading: true, error: null });
    try {
      await rewriteArc(projectId, arcId, specId);
      await get().refreshProjectData(projectId);
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Rewrite arc thất bại.' });
      throw error;
    }
  },

  applyChapterRewrite: async (projectId, taskId) => {
    set({ isLoading: true, error: null });
    try {
      await rewriteChapterTask(projectId, taskId);
      await get().refreshProjectData(projectId);
      const prev = get().activeSession;
      if (prev) {
        const updated = {
          ...prev,
          completedTasks: [...prev.completedTasks, taskId],
          savedAt: now(),
        };
        persistSurgerySession(updated);
        set({ activeSession: updated });
      }
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Rewrite chapter thất bại.' });
      throw error;
    }
  },

  resumeSession: async (projectId) => {
    const session = loadSurgerySession(projectId);
    if (!session) return null;
    set({ activeSession: session });
    await get().refreshProjectData(projectId);
    return session;
  },

  endSession: (projectId) => {
    clearSurgerySession(projectId);
    set({ activeSession: null });
  },
}));
