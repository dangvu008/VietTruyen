/**
 * File: use_ai_store.ts
 * Purpose: Zustand store quản lý AI models, active model, và subscription status
 * Layer: Store
 * Domain: AI → [model management, subscription tracking]
 *
 * v2: Removed apiKeys (proxy handles server-side).
 *     Added subscription state from Supabase.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createId } from '../core/id';
import { DEFAULT_AI_MODELS } from '../data/ai_models';
import type { AiTaskType, TaskModelOverrideMap } from '../lib/ai/model_router';
import { normalizeAiModels } from '../lib/ai/model_aliases';
import { tryEnsureLocalNineRouterStarted } from '../lib/ai/local_proxy_runtime';
import {
  fetchNineRouterAvailability,
  fetchNineRouterModels,
  getDefaultNineRouterBaseUrl,
  mergeNineRouterModels,
  NINE_ROUTER_PROVIDER_ID,
  normalizeNineRouterBaseUrl,
} from '../lib/ai/nine_router_catalog';
import {
  checkAllProvidersHealth,
  clearHealthCache,
  mapProviderResultsToModelHealth,
} from '../lib/ai/model_health_checker';
import { supabase } from '../lib/supabase/supabase_client';
import type { AiModel, AiModelHealth, AiProvider, WorkflowEngineType } from '../types/story';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  hint?: string;
}

export interface SubscriptionState {
  tier: 'free' | 'basic' | 'pro';
  status: 'active' | 'past_due' | 'cancelled';
  tokensUsed: number;
  tokensLimit: number;
  currentMonth: string;
}

export interface NineRouterSyncState {
  baseUrl: string;
  isSyncing: boolean;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

const DEFAULT_ACTIVE_EXPERTS = [
  'van-hoc',
  'xay-dung-tg',
  'tuyen-nhan-vat',
  'quan-tri-boi-canh',
];

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeContextSize(value: number): number {
  if (!Number.isFinite(value)) return 16000;
  return Math.max(4000, Math.min(128000, Math.round(value / 1000) * 1000));
}

function mergeDefaultModels(models: AiModel[]): AiModel[] {
  const defaultById = new Map(DEFAULT_AI_MODELS.map((model) => [model.id, model]));
  const enrichedModels = models.map((model) => {
    const defaultModel = defaultById.get(model.id);
    if (!defaultModel) return model;

    return {
      ...defaultModel,
      ...model,
      inputCostPer1M: model.inputCostPer1M ?? defaultModel.inputCostPer1M,
      outputCostPer1M: model.outputCostPer1M ?? defaultModel.outputCostPer1M,
      contextWindow: model.contextWindow ?? defaultModel.contextWindow,
      capabilities: model.capabilities ?? defaultModel.capabilities,
    };
  });
  const existingIds = new Set(enrichedModels.map((model) => model.id));
  const missingDefaults = DEFAULT_AI_MODELS.filter((model) => !existingIds.has(model.id));
  return [...enrichedModels, ...missingDefaults];
}

function ensureNineRouterProvider(providers: CustomProvider[], baseUrl: string): CustomProvider[] {
  const normalizedBaseUrl = normalizeNineRouterBaseUrl(baseUrl);
  const nextProvider: CustomProvider = {
    id: NINE_ROUTER_PROVIDER_ID,
    name: '9router',
    baseUrl: normalizedBaseUrl,
    hint: 'Local 9router OpenAI-compatible proxy',
  };
  const existingIndex = providers.findIndex((provider) => provider.id === NINE_ROUTER_PROVIDER_ID);
  if (existingIndex === -1) return [...providers, nextProvider];

  return providers.map((provider, index) => (
    index === existingIndex ? { ...provider, ...nextProvider } : provider
  ));
}

function removeMissingModelOverrides(
  overrides: TaskModelOverrideMap,
  modelIds: Set<string>
): TaskModelOverrideMap {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, modelId]) => modelIds.has(modelId))
  ) as TaskModelOverrideMap;
}

function resolveSafeManualModelId(models: AiModel[], currentManualId: string): string {
  return models.find((model) => model.id === currentManualId)?.id
    ?? models[0]?.id
    ?? '';
}

function resolveProviderModelId(models: AiModel[], provider: string): string | undefined {
  return models.find((model) => model.provider === provider)?.id;
}

function pruneExpiredModelHealth(modelHealth: Record<string, AiModelHealth>): Record<string, AiModelHealth> {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(modelHealth).filter(([, health]) => (
      health.status !== 'cooldown'
      || !health.unavailableUntil
      || new Date(health.unavailableUntil).getTime() > now
    ))
  );
}

interface AiState {
  models: AiModel[];
  customProviders: CustomProvider[];
  activeModelId: string;
  manualModelId: string;
  preferredProvider: string;
  taskModelOverrides: TaskModelOverrideMap;
  workflowEngine: WorkflowEngineType;
  subscription: SubscriptionState;
  temperature: number;
  topP: number;
  contextSize: number;
  autoSummarize: boolean;
  persona: string;
  activeExperts: string[];
  nineRouter: NineRouterSyncState;
  modelHealth: Record<string, AiModelHealth>;
  lastHealthCheckAt?: string;
  isCheckingHealth: boolean;

  // Model management
  setActiveModel: (id: string) => void;
  setPreferredProvider: (provider: string) => void;
  setSmartRoutingEnabled: (enabled: boolean) => void;
  setTaskModelOverride: (taskType: AiTaskType, modelId: string) => void;
  setWorkflowEngine: (engine: WorkflowEngineType) => void;
  addModel: (model: Omit<AiModel, 'id' | 'isCustom'>) => void;
  updateModel: (id: string, patch: Partial<AiModel>) => void;
  removeModel: (id: string) => void;
  getActiveModel: () => AiModel | undefined;
  syncNineRouterModels: () => Promise<void>;
  refreshNineRouterAvailability: () => Promise<void>;
  setNineRouterBaseUrl: (baseUrl: string) => void;
  checkAllProvidersHealth: () => Promise<void>;
  markModelUnavailable: (
    modelId: string,
    options?: { status?: AiModelHealth['status']; unavailableUntil?: string; lastError?: string }
  ) => void;
  clearModelHealth: (modelId?: string) => void;

  // Custom provider management
  addCustomProvider: (provider: CustomProvider) => void;
  removeCustomProvider: (id: string) => void;

  // Subscription
  fetchSubscription: () => Promise<void>;
  updateTokenUsage: (monthlyUsed: number, monthlyLimit: number) => void;

  // Assistant settings
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setContextSize: (value: number) => void;
  setAutoSummarize: (value: boolean) => void;
  setPersona: (value: string) => void;
  toggleExpert: (expertId: string) => void;
  setActiveExperts: (expertIds: string[]) => void;

  // Legacy compatibility
  /** @deprecated — proxy handles API keys server-side */
  apiKeys: Record<string, string>;
  /** @deprecated — use proxy mode */
  setApiKey: (provider: AiProvider, key: string) => void;
  /** @deprecated — use proxy mode */
  getApiKey: (provider: AiProvider) => string;
}

type PersistedAiState = Partial<Pick<
  AiState,
  | 'models'
  | 'customProviders'
  | 'activeModelId'
  | 'manualModelId'
  | 'preferredProvider'
  | 'taskModelOverrides'
  | 'workflowEngine'
  | 'temperature'
  | 'topP'
  | 'contextSize'
  | 'autoSummarize'
  | 'persona'
  | 'activeExperts'
  | 'nineRouter'
  | 'modelHealth'
>>;

const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  tier: 'free',
  status: 'active',
  tokensUsed: 0,
  tokensLimit: 50000,
  currentMonth: new Date().toISOString().substring(0, 7),
};

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      models: [...DEFAULT_AI_MODELS],
      customProviders: [],
      activeModelId: 'auto',
      manualModelId: resolveProviderModelId(DEFAULT_AI_MODELS, 'openrouter') ?? DEFAULT_AI_MODELS[0]?.id ?? '',
      preferredProvider: 'openrouter',
      taskModelOverrides: {},
      workflowEngine: 'api',
      subscription: { ...DEFAULT_SUBSCRIPTION },
      temperature: 0.6,
      topP: 0.9,
      contextSize: 16000,
      autoSummarize: true,
      persona: 'Trợ lý',
      activeExperts: [...DEFAULT_ACTIVE_EXPERTS],
      nineRouter: {
        baseUrl: getDefaultNineRouterBaseUrl(),
        isSyncing: false,
      },
      modelHealth: {},
      lastHealthCheckAt: undefined,
      isCheckingHealth: false,

      // Legacy — kept for backward compat, no longer primary path
      apiKeys: {},

      setActiveModel: (id) =>
        set((state) => ({
          activeModelId: id,
          manualModelId: id === 'auto' ? state.manualModelId : id,
        })),
      setPreferredProvider: (provider) =>
        set((state) => {
          const nextManualId = resolveProviderModelId(state.models, provider) ?? state.manualModelId;
          return {
            preferredProvider: provider,
            manualModelId: nextManualId,
            activeModelId: state.activeModelId === 'auto' ? 'auto' : nextManualId,
          };
        }),
      setSmartRoutingEnabled: (enabled) =>
        set((state) => {
          if (enabled) {
            return { activeModelId: 'auto' };
          }

          const fallbackManualId =
            state.models.find((model) => model.id === state.manualModelId)?.id
            ?? state.models[0]?.id
            ?? 'auto';

          return {
            activeModelId: fallbackManualId,
            manualModelId: fallbackManualId === 'auto' ? state.manualModelId : fallbackManualId,
          };
        }),
      setTaskModelOverride: (taskType, modelId) =>
        set((state) => {
          if (modelId === 'auto') {
            const nextOverrides = { ...state.taskModelOverrides };
            delete nextOverrides[taskType];
            return { taskModelOverrides: nextOverrides };
          }

          return {
            taskModelOverrides: {
              ...state.taskModelOverrides,
              [taskType]: modelId,
            },
          };
        }),
      setWorkflowEngine: (engine) => set({ workflowEngine: engine }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      getApiKey: (provider) => get().apiKeys[provider] || '',

      addModel: (model) =>
        set((state) => ({
          models: [
            ...state.models,
            { ...model, id: createId(), isCustom: true, tier: model.tier ?? 'balanced' },
          ],
        })),

      updateModel: (id, patch) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
        })),

      removeModel: (id) =>
        set((state) => {
          const next = state.models.filter((m) => m.id !== id);
          const nextManualId =
            state.manualModelId === id
              ? next[0]?.id ?? ''
              : state.manualModelId;
          const nextTaskOverrides = Object.fromEntries(
            Object.entries(state.taskModelOverrides).filter(([, modelId]) => modelId !== id)
          ) as TaskModelOverrideMap;
          const nextActive =
            state.activeModelId === 'auto'
              ? 'auto'
              : state.activeModelId === id
                ? nextManualId || 'auto'
                : state.activeModelId;

          return {
            models: next,
            activeModelId: nextActive,
            manualModelId: nextManualId,
            taskModelOverrides: nextTaskOverrides,
            modelHealth: Object.fromEntries(
              Object.entries(state.modelHealth).filter(([modelId]) => modelId !== id)
            ),
          };
        }),

      addCustomProvider: (provider) =>
        set((state) => ({
          customProviders: [...state.customProviders, { ...provider, id: provider.id || createId() }],
        })),

      removeCustomProvider: (id) =>
        set((state) => {
          // If we remove a custom provider, we should ideally handle mapped apiKeys, but for now just remove the config
          return { customProviders: state.customProviders.filter((p) => p.id !== id) };
        }),

      getActiveModel: () => {
        const state = get();
        const resolvedId = state.activeModelId === 'auto' ? state.manualModelId : state.activeModelId;
        return state.models.find((m) => m.id === resolvedId);
      },

      setNineRouterBaseUrl: (baseUrl) =>
        set((state) => {
          const normalizedBaseUrl = normalizeNineRouterBaseUrl(baseUrl);
          return {
            nineRouter: {
              ...state.nineRouter,
              baseUrl: normalizedBaseUrl,
              lastSyncError: undefined,
            },
            customProviders: ensureNineRouterProvider(state.customProviders, normalizedBaseUrl),
          };
        }),

      syncNineRouterModels: async () => {
        const baseUrl = normalizeNineRouterBaseUrl(get().nineRouter.baseUrl);
        set((state) => ({
          nineRouter: { ...state.nineRouter, baseUrl, isSyncing: true, lastSyncError: undefined },
          customProviders: ensureNineRouterProvider(state.customProviders, baseUrl),
        }));

        try {
          await tryEnsureLocalNineRouterStarted(baseUrl);
          const [syncedModels, availability] = await Promise.all([
            fetchNineRouterModels(baseUrl),
            fetchNineRouterAvailability(baseUrl).catch(() => ({} as Record<string, AiModelHealth>)),
          ]);

          set((state) => {
            const nextModels = mergeNineRouterModels(state.models, syncedModels);
            const modelIds = new Set(nextModels.map((model) => model.id));
            const nextManualId = resolveSafeManualModelId(nextModels, state.manualModelId);
            const nextPreferredModelId = resolveProviderModelId(nextModels, state.preferredProvider);
            const nextActiveModelId =
              state.activeModelId === 'auto'
                ? 'auto'
                : modelIds.has(state.activeModelId)
                  ? state.activeModelId
                  : nextManualId || 'auto';

            return {
              models: nextModels,
              customProviders: ensureNineRouterProvider(state.customProviders, baseUrl),
              manualModelId: nextPreferredModelId ?? nextManualId,
              activeModelId: nextActiveModelId,
              taskModelOverrides: removeMissingModelOverrides(state.taskModelOverrides, modelIds),
              modelHealth: pruneExpiredModelHealth({ ...state.modelHealth, ...availability }),
              nineRouter: {
                ...state.nineRouter,
                baseUrl,
                isSyncing: false,
                lastSyncedAt: new Date().toISOString(),
                lastSyncError: undefined,
              },
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set((state) => ({
            nineRouter: {
              ...state.nineRouter,
              baseUrl,
              isSyncing: false,
              lastSyncError: message,
            },
          }));
          throw error;
        }
      },

      refreshNineRouterAvailability: async () => {
        const baseUrl = normalizeNineRouterBaseUrl(get().nineRouter.baseUrl);
        await tryEnsureLocalNineRouterStarted(baseUrl);
        const availability = await fetchNineRouterAvailability(baseUrl);
        set((state) => ({
          modelHealth: pruneExpiredModelHealth({ ...state.modelHealth, ...availability }),
        }));
      },

      checkAllProvidersHealth: async () => {
        const state = get();
        if (state.isCheckingHealth) return;

        set({ isCheckingHealth: true });
        try {
          const nineRouterBaseUrl = normalizeNineRouterBaseUrl(state.nineRouter.baseUrl);
          const results = await checkAllProvidersHealth(
            state.models,
            state.apiKeys,
            nineRouterBaseUrl,
          );
          const healthUpdates = mapProviderResultsToModelHealth(state.models, results);

          // [Domain:AI] STEP — Merge: chỉ apply unavailable mới, clear cũ nếu provider đã available
          set((current) => {
            const next = { ...current.modelHealth };

            // Clear health-check-originated cooldowns cho providers đã available
            const availableProviders = new Set(
              results.filter((r) => r.status === 'available').map((r) => r.provider),
            );
            for (const model of current.models) {
              const existing = next[model.id];
              if (
                existing
                && availableProviders.has(model.provider)
                && existing.lastError?.startsWith('[Health Check]')
              ) {
                delete next[model.id];
              }
            }

            // Apply new unavailable marks
            Object.assign(next, healthUpdates);

            return {
              modelHealth: pruneExpiredModelHealth(next),
              lastHealthCheckAt: new Date().toISOString(),
              isCheckingHealth: false,
            };
          });

          clearHealthCache();
        } catch (error) {
          console.warn('[AiStore] Health check failed:', error);
          set({ isCheckingHealth: false });
        }
      },

      markModelUnavailable: (modelId, options) =>
        set((state) => {
          const unavailableUntil = options?.unavailableUntil
            ?? new Date(Date.now() + 2 * 60 * 1000).toISOString();
          return {
            modelHealth: {
              ...state.modelHealth,
              [modelId]: {
                status: options?.status ?? 'cooldown',
                unavailableUntil,
                lastError: options?.lastError,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      clearModelHealth: (modelId) =>
        set((state) => {
          if (!modelId) return { modelHealth: {} };
          const next = { ...state.modelHealth };
          delete next[modelId];
          return { modelHealth: next };
        }),

	      fetchSubscription: async () => {
	        try {
	          const { data: { user } } = await supabase.auth.getUser();
	          if (!user) return;

	          // Fetch subscription tier
	          const { data: subscriptions } = await supabase
	            .from('subscriptions')
	            .select('tier, status')
	            .eq('user_id', user.id)
	            .limit(1);

	          // Fetch current month token usage
	          const currentMonth = new Date().toISOString().substring(0, 7);
	          const { data: usageRows } = await supabase
	            .from('token_usage')
	            .select('tokens_used, tokens_limit')
	            .eq('user_id', user.id)
	            .eq('month', currentMonth)
	            .limit(1);

	          const sub = subscriptions?.[0];
	          const usage = usageRows?.[0];

	          set({
	            subscription: {
              tier: (sub?.tier as SubscriptionState['tier']) || 'free',
              status: (sub?.status as SubscriptionState['status']) || 'active',
              tokensUsed: usage?.tokens_used ?? 0,
              tokensLimit: usage?.tokens_limit ?? 50000,
              currentMonth,
            },
          });
        } catch (err) {
          console.error('[AiStore] Failed to fetch subscription:', err);
        }
      },

      updateTokenUsage: (monthlyUsed, monthlyLimit) =>
        set((state) => ({
          subscription: {
            ...state.subscription,
            tokensUsed: monthlyUsed,
            tokensLimit: monthlyLimit,
          },
        })),

      setTemperature: (value) => set({ temperature: clampUnitInterval(value) }),
      setTopP: (value) => set({ topP: clampUnitInterval(value) }),
      setContextSize: (value) => set({ contextSize: normalizeContextSize(value) }),
      setAutoSummarize: (value) => set({ autoSummarize: value }),
      setPersona: (value) => set({ persona: value.trim() || 'Trợ lý' }),
      toggleExpert: (expertId) =>
        set((state) => {
          const isActive = state.activeExperts.includes(expertId);
          return {
            activeExperts: isActive
              ? state.activeExperts.filter((item) => item !== expertId)
              : [...state.activeExperts, expertId],
          };
        }),
      setActiveExperts: (expertIds) =>
        set({
          activeExperts: Array.from(new Set(expertIds)),
        }),
    }),
    {
      name: 'viettruyen-ai-settings',
      version: 7,
      migrate: (persistedState) => {
        const typedState = (persistedState ?? {}) as PersistedAiState;
        const normalizedModels = typedState.models
          ? mergeDefaultModels(normalizeAiModels(typedState.models))
          : [...DEFAULT_AI_MODELS];
        const preservedManualId =
          typedState.activeModelId && typedState.activeModelId !== 'auto'
            ? typedState.activeModelId
            : typedState.manualModelId;
        const preferredProvider = typedState.preferredProvider ?? 'openrouter';
        const fallbackManualId =
          resolveProviderModelId(normalizedModels, preferredProvider)
          ?? normalizedModels.find((model) => model.id === preservedManualId)?.id
          ?? normalizedModels[0]?.id
          ?? '';

        return {
          ...typedState,
          models: normalizedModels,
          manualModelId: fallbackManualId,
          preferredProvider,
          taskModelOverrides: typedState.taskModelOverrides ?? {},
          nineRouter: {
            baseUrl: normalizeNineRouterBaseUrl(typedState.nineRouter?.baseUrl),
            isSyncing: false,
            lastSyncedAt: typedState.nineRouter?.lastSyncedAt,
            lastSyncError: typedState.nineRouter?.lastSyncError,
          },
          modelHealth: pruneExpiredModelHealth(typedState.modelHealth ?? {}),
        };
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        models: state.models,
        customProviders: state.customProviders,
        activeModelId: state.activeModelId,
        manualModelId: state.manualModelId,
        preferredProvider: state.preferredProvider,
        taskModelOverrides: state.taskModelOverrides,
        workflowEngine: state.workflowEngine,
        temperature: state.temperature,
        topP: state.topP,
        contextSize: state.contextSize,
        autoSummarize: state.autoSummarize,
        persona: state.persona,
        activeExperts: state.activeExperts,
        nineRouter: {
          ...state.nineRouter,
          isSyncing: false,
        },
        modelHealth: pruneExpiredModelHealth(state.modelHealth),
        // Don't persist apiKeys or subscription to localStorage
        // subscription is fetched from server on each session
      }),
    }
  )
);
