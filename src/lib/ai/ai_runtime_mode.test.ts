import { describe, expect, it } from 'vitest';
import { isAiRuntimeReady, resolveAiRuntimeMode } from './ai_runtime_mode';

describe('ai_runtime_mode', () => {
  it('returns local_proxy when local proxy is enabled', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: false,
      localProxyEnabled: true,
    });

    expect(mode).toBe('local_proxy');
    expect(isAiRuntimeReady(mode)).toBe(true);
  });

  it('returns edge_proxy when authenticated and local proxy is disabled', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: true,
      localProxyEnabled: false,
    });

    expect(mode).toBe('edge_proxy');
    expect(isAiRuntimeReady(mode)).toBe(true);
  });

  it('returns disabled for unauthenticated users without local proxy', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: false,
      localProxyEnabled: false,
    });

    expect(mode).toBe('disabled');
    expect(isAiRuntimeReady(mode)).toBe(false);
  });

  it('prefers local_proxy over edge_proxy when both signals are positive', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: true,
      localProxyEnabled: true,
    });

    expect(mode).toBe('local_proxy');
  });
});
