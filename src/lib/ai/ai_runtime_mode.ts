export type AiRuntimeMode = 'local_proxy' | 'edge_proxy' | 'direct_provider' | 'disabled';

export interface ResolveAiRuntimeModeInput {
  isAuthenticated: boolean;
  isGuest: boolean;
  localProxyEnabled: boolean;
  hasDirectApiKey: boolean;
}

export const isLocalAiProxyEnabled = () => import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true';

export function resolveAiRuntimeMode(input: ResolveAiRuntimeModeInput): AiRuntimeMode {
  const {
    isAuthenticated,
    isGuest,
    localProxyEnabled,
    hasDirectApiKey,
  } = input;

  if (localProxyEnabled) {
    return 'local_proxy';
  }

  if (isAuthenticated) {
    return 'edge_proxy';
  }

  if (isGuest && hasDirectApiKey) {
    return 'direct_provider';
  }

  return 'disabled';
}
export const isAiRuntimeReady = (mode: AiRuntimeMode) => mode !== 'disabled';
