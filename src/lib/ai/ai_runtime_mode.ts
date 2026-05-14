// [Wave 3 / D-Wave3=C] direct_provider mode removed alongside the guest/BYOK
// flow. apiKeys storage is retained for one release (see use_ai_store) but is
// no longer consulted as a readiness signal. If dev needs direct-provider
// access for local debugging, gate it behind import.meta.env.DEV in the call
// site — do NOT reintroduce it as a production runtime mode.
export type AiRuntimeMode = 'local_proxy' | 'edge_proxy' | 'disabled';

export interface ResolveAiRuntimeModeInput {
  isAuthenticated: boolean;
  localProxyEnabled: boolean;
}

export const isLocalAiProxyEnabled = () => import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true';

export function resolveAiRuntimeMode(input: ResolveAiRuntimeModeInput): AiRuntimeMode {
  const { isAuthenticated, localProxyEnabled } = input;

  if (localProxyEnabled) {
    return 'local_proxy';
  }

  if (isAuthenticated) {
    return 'edge_proxy';
  }

  return 'disabled';
}

export const isAiRuntimeReady = (mode: AiRuntimeMode) => mode !== 'disabled';
